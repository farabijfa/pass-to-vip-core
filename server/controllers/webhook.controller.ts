import type { Request, Response } from "express";
import { supabaseService } from "../services";
import { generate } from "short-uuid";

interface PassKitPassData {
  id?: string;
  classId?: string;
  protocol?: number;
  personDetails?: {
    displayName?: string;
    emailAddress?: string;
  };
  metadata?: {
    status?: number;
    lifecycleEvents?: number[];
    altId?: string;
    issueIpAddress?: string;
    installIpAddress?: string;
    firstUninstalledAt?: { seconds: number; nanos: number };
    lastUninstalledAt?: { seconds: number; nanos: number };
  };
  recordData?: Record<string, string>;
}

interface PassKitWebhookPayload {
  event?: string;
  pass?: PassKitPassData;
  id?: string;
  passId?: string;
  memberId?: string;
  eventType?: string;
  programId?: string;
  timestamp?: string;
}

const PASSKIT_EVENTS = {
  RECORD_CREATED: "PASS_EVENT_RECORD_CREATED",
  INSTALLED: "PASS_EVENT_INSTALLED",
  UNINSTALLED: "PASS_EVENT_UNINSTALLED",
  RECORD_UPDATED: "PASS_EVENT_RECORD_UPDATED",
  RECORD_DELETED: "PASS_EVENT_RECORD_DELETED",
  INVALIDATED: "PASS_EVENT_INVALIDATED",
};

const PROTOCOL_NAMES: Record<number, string> = {
  100: "MEMBERSHIP",
  200: "COUPON",
  300: "EVENT_TICKET",
  400: "BOARDING_PASS",
  500: "GENERIC",
};

function createResponse<T>(
  success: boolean,
  data?: T,
  error?: { code: string; message: string; details?: any },
  requestId?: string
) {
  return {
    success,
    data,
    error,
    metadata: {
      requestId: requestId || generate(),
      timestamp: new Date().toISOString(),
    },
  };
}

function extractPassId(payload: PassKitWebhookPayload): string | null {
  if (payload.pass?.id) {
    return payload.pass.id;
  }
  return payload.id || payload.passId || payload.memberId || null;
}

function getProtocolName(protocol?: number): string {
  if (!protocol) return "UNKNOWN";
  return PROTOCOL_NAMES[protocol] || `PROTOCOL_${protocol}`;
}

function isUninstallEvent(event?: string): boolean {
  if (!event) return false;
  
  const uninstallEvents = [
    PASSKIT_EVENTS.UNINSTALLED,
    PASSKIT_EVENTS.RECORD_DELETED,
    "delete",
    "uninstall",
    "UNINSTALL",
    "DELETE",
  ];
  
  return uninstallEvents.includes(event);
}

class WebhookController {
  async handlePassKitUninstall(req: Request, res: Response) {
    const requestId = (req.headers["x-request-id"] as string) || generate();
    
    try {
      const payload: PassKitWebhookPayload = req.body;
      
      const eventType = payload.event || payload.eventType;
      const passKitId = extractPassId(payload);
      const protocol = payload.pass?.protocol;
      const classId = payload.pass?.classId;
      const protocolName = getProtocolName(protocol);
      const email = payload.pass?.personDetails?.emailAddress;

      console.log(`\n📩 [Webhook] Received PassKit Event`);
      console.log(`   Event: ${eventType}`);
      console.log(`   Pass ID: ${passKitId}`);
      console.log(`   Protocol: ${protocolName} (${protocol || 'N/A'})`);
      console.log(`   Class/Campaign ID: ${classId || 'N/A'}`);
      console.log(`   Email: ${email || 'N/A'}`);
      console.log(`   Full Payload:`, JSON.stringify(payload, null, 2));

      if (!isUninstallEvent(eventType)) {
        console.log(`   ⏭️ Ignoring non-uninstall event: ${eventType}`);
        return res.status(200).json(
          createResponse(true, { 
            acknowledged: true, 
            action: "ignored",
            event: eventType,
            reason: "not_uninstall_event"
          }, undefined, requestId)
        );
      }

      if (!passKitId) {
        console.warn("   ⚠️ Missing pass ID in webhook payload");
        return res.status(200).json(
          createResponse(true, { 
            acknowledged: true, 
            action: "ignored", 
            reason: "missing_pass_id" 
          }, undefined, requestId)
        );
      }

      const updateResult = await supabaseService.processPassUninstall(passKitId);

      if (!updateResult.success) {
        console.warn(`   ⚠️ Pass ${passKitId} not found in database: ${updateResult.error}`);
        return res.status(200).json(
          createResponse(true, { 
            acknowledged: true, 
            action: "not_found", 
            passId: passKitId,
            protocol: protocolName,
            classId: classId,
          }, undefined, requestId)
        );
      }

      console.log(`   ✅ Churn recorded for ${protocolName} Pass: ${passKitId} (UUID: ${updateResult.passUuid})`);

      return res.status(200).json(
        createResponse(
          true,
          {
            acknowledged: true,
            action: "processed",
            event: eventType,
            passId: passKitId,
            passUuid: updateResult.passUuid,
            transactionId: updateResult.transactionId,
            protocol: protocolName,
            classId: classId,
          },
          undefined,
          requestId
        )
      );

    } catch (error) {
      console.error("❌ [Webhook] Error processing PassKit uninstall:", error);
      
      return res.status(200).json(
        createResponse(
          true,
          { 
            acknowledged: true, 
            action: "error", 
            error: error instanceof Error ? error.message : "Unknown error" 
          },
          undefined,
          requestId
        )
      );
    }
  }

  async handlePassKitEvent(req: Request, res: Response) {
    const requestId = (req.headers["x-request-id"] as string) || generate();
    
    try {
      const payload: PassKitWebhookPayload = req.body;
      const eventType = payload.event || payload.eventType || "unknown";
      const passKitId = extractPassId(payload);
      const protocol = payload.pass?.protocol;
      const protocolName = getProtocolName(protocol);
      
      console.log(`\n📩 [Webhook] Received PassKit Event`);
      console.log(`   Event: ${eventType}`);
      console.log(`   Pass ID: ${passKitId || 'N/A'}`);
      console.log(`   Protocol: ${protocolName}`);
      console.log(`   Payload:`, JSON.stringify(payload, null, 2));

      if (isUninstallEvent(eventType)) {
        console.log(`   🔄 Routing to uninstall handler...`);
        return this.handlePassKitUninstall(req, res);
      }

      return res.status(200).json(
        createResponse(true, { 
          acknowledged: true, 
          event: eventType,
          passId: passKitId,
          protocol: protocolName,
        }, undefined, requestId)
      );
    } catch (error) {
      console.error("❌ [Webhook] Error:", error);
      return res.status(200).json(
        createResponse(true, { acknowledged: true, action: "error" }, undefined, requestId)
      );
    }
  }
}

export const webhookController = new WebhookController();
