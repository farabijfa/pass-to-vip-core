import type { Request, Response } from "express";
import { supabaseService } from "../services";
import { generate } from "short-uuid";

interface PassKitPersonDetails {
  displayName?: string;
  forename?: string;
  surname?: string;
  emailAddress?: string;
  mobileNumber?: string;
}

interface PassKitPassData {
  id?: string;
  classId?: string;
  programId?: string;
  protocol?: number;
  externalId?: string;
  personDetails?: PassKitPersonDetails;
  person?: PassKitPersonDetails;
  metadata?: {
    status?: number;
    lifecycleEvents?: number[];
    altId?: string;
    issueIpAddress?: string;
    installIpAddress?: string;
    firstUninstalledAt?: { seconds: number; nanos: number };
    lastUninstalledAt?: { seconds: number; nanos: number };
    birthday?: string;
  };
  meta?: Record<string, string>;
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
  meta?: Record<string, string>;
  metadata?: {
    birthday?: string;
    [key: string]: any;
  };
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

function validateAndFormatBirthday(rawBirthday: string | null | undefined): string | null {
  if (!rawBirthday) return null;
  
  try {
    const dateFormats = [
      /^\d{4}-\d{2}-\d{2}$/,
      /^\d{2}\/\d{2}\/\d{4}$/,
      /^\d{4}\/\d{2}\/\d{2}$/,
    ];
    
    const isoMatch = rawBirthday.match(/^\d{4}-\d{2}-\d{2}/);
    if (isoMatch) {
      const date = new Date(isoMatch[0]);
      if (!isNaN(date.getTime()) && date.getFullYear() > 1900 && date.getFullYear() < 2100) {
        return isoMatch[0];
      }
    }
    
    const date = new Date(rawBirthday);
    if (!isNaN(date.getTime()) && date.getFullYear() > 1900 && date.getFullYear() < 2100) {
      return date.toISOString().split('T')[0];
    }
    
    console.warn(`   ⚠️ Invalid birthday format: ${rawBirthday}`);
    return null;
  } catch {
    console.warn(`   ⚠️ Birthday parsing failed: ${rawBirthday}`);
    return null;
  }
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

      if (eventType === PASSKIT_EVENTS.RECORD_CREATED) {
        console.log(`   🔄 Routing to enrollment handler...`);
        return this.handlePassKitEnrollment(req, res);
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

  async handlePassKitEnrollment(req: Request, res: Response) {
    const requestId = (req.headers["x-request-id"] as string) || generate();
    
    try {
      const payload: PassKitWebhookPayload = req.body;
      
      const passKitId = extractPassId(payload);
      const passkitProgramId = payload.pass?.classId || payload.pass?.programId || payload.programId;
      const protocol = payload.pass?.protocol;
      const protocolName = getProtocolName(protocol);
      
      const person = payload.pass?.personDetails || payload.pass?.person || {};
      const passMeta = payload.pass?.meta || {};
      const passMetadata = payload.pass?.metadata || {};
      const payloadMeta = payload.meta || {};
      const payloadMetadata = payload.metadata || {};
      const recordData = payload.pass?.recordData || {};
      
      const email = person.emailAddress;
      const firstName = person.forename || (person.displayName ? person.displayName.split(' ')[0] : undefined);
      const lastName = person.surname || (person.displayName ? person.displayName.split(' ').slice(1).join(' ') : undefined);
      
      const rawBirthday = (passMeta as Record<string, string>).birthday 
        || (passMetadata as Record<string, any>).birthday 
        || payloadMeta.birthday 
        || payloadMetadata.birthday
        || recordData.birthday 
        || null;

      const birthday = validateAndFormatBirthday(rawBirthday);

      console.log(`\n🎫 [Webhook] PassKit Enrollment Event (Vertical B/C - SMARTPASS)`);
      console.log(`   Pass ID: ${passKitId}`);
      console.log(`   Program ID: ${passkitProgramId || 'N/A'}`);
      console.log(`   Protocol: ${protocolName}`);
      console.log(`   Email: ${email || 'N/A'}`);
      console.log(`   Name: ${firstName || ''} ${lastName || ''}`);
      console.log(`   Birthday: ${birthday || 'Not provided'}`);

      if (!passKitId) {
        console.warn("   ⚠️ Missing pass ID in enrollment webhook");
        return res.status(200).json(
          createResponse(true, { 
            acknowledged: true, 
            action: "ignored", 
            reason: "missing_pass_id" 
          }, undefined, requestId)
        );
      }

      if (!email) {
        console.warn("   ⚠️ Missing email in enrollment webhook");
        return res.status(200).json(
          createResponse(true, { 
            acknowledged: true, 
            action: "ignored", 
            reason: "missing_email" 
          }, undefined, requestId)
        );
      }

      let programId: string | null = null;
      let programProtocol = protocolName;

      if (passkitProgramId) {
        const programResult = await supabaseService.getProgramByPasskitId(passkitProgramId);
        if (programResult.success && programResult.program) {
          programId = programResult.program.id;
          programProtocol = programResult.program.protocol;
          console.log(`   📋 Found program: ${programResult.program.name} (${programId})`);
        } else {
          console.warn(`   ⚠️ Program not found for PassKit ID: ${passkitProgramId}`);
        }
      }

      const userResult = await supabaseService.upsertUser({
        email,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        birthDate: birthday,
      });

      if (!userResult.success) {
        console.error(`   ❌ Failed to upsert user: ${userResult.error}`);
        return res.status(200).json(
          createResponse(true, { 
            acknowledged: true, 
            action: "error",
            error: userResult.error,
          }, undefined, requestId)
        );
      }

      console.log(`   👤 User synced: ${userResult.userId}`);

      const externalId = `PUB-${generate()}`;
      
      let passAction = "skipped";
      let passId: string | undefined;
      
      if (programId && userResult.userId) {
        const passResult = await supabaseService.createPassFromEnrollment({
          programId,
          passkitProgramId: passkitProgramId || '',
          passkitInternalId: passKitId,
          userId: userResult.userId,
          externalId,
          protocol: programProtocol,
          email,
          firstName: firstName || undefined,
          lastName: lastName || undefined,
          enrollmentSource: "SMARTPASS",
        });

        if (!passResult.success) {
          console.error(`   ❌ Failed to create pass record: ${passResult.error}`);
          passAction = "error";
        } else if (passResult.isDuplicate) {
          console.log(`   ℹ️ Duplicate enrollment detected (idempotent)`);
          passAction = "duplicate";
        } else {
          console.log(`   ✅ Pass record created: ${passResult.passId}`);
          passAction = "created";
          passId = passResult.passId;
        }
      } else {
        console.warn(`   ⚠️ Skipping pass creation: No program found for PassKit ID ${passkitProgramId}`);
        passAction = "no_program";
      }

      console.log(`   ✅ SMARTPASS Enrollment Complete: ${email} (${passAction})`);

      return res.status(200).json(
        createResponse(
          true,
          {
            acknowledged: true,
            action: passAction,
            event: PASSKIT_EVENTS.RECORD_CREATED,
            passKitId,
            passId,
            userId: userResult.userId,
            email,
            protocol: programProtocol,
            enrollmentSource: "SMARTPASS",
          },
          undefined,
          requestId
        )
      );

    } catch (error) {
      console.error("❌ [Webhook] Error processing PassKit enrollment:", error);
      
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
}

export const webhookController = new WebhookController();
