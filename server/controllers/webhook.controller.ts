import type { Request, Response } from "express";
import { supabaseService } from "../services";
import { generate } from "short-uuid";

interface PassKitWebhookPayload {
  id?: string;
  passId?: string;
  event?: string;
  eventType?: string;
  programId?: string;
  memberId?: string;
  timestamp?: string;
}

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

class WebhookController {
  async handlePassKitUninstall(req: Request, res: Response) {
    const requestId = (req.headers["x-request-id"] as string) || generate();
    
    try {
      const payload: PassKitWebhookPayload = req.body;
      
      const passKitId = payload.id || payload.passId || payload.memberId;
      const eventType = payload.event || payload.eventType || "delete";

      console.log(`\n📩 [Webhook] Received PassKit Event`);
      console.log(`   Event: ${eventType}`);
      console.log(`   Pass ID: ${passKitId}`);
      console.log(`   Payload:`, JSON.stringify(payload, null, 2));

      if (eventType !== "delete" && eventType !== "uninstall") {
        console.log(`   ⏭️ Ignoring non-delete event: ${eventType}`);
        return res.status(200).json(
          createResponse(true, { acknowledged: true, action: "ignored" }, undefined, requestId)
        );
      }

      if (!passKitId) {
        console.warn("   ⚠️ Missing pass ID in webhook payload");
        return res.status(200).json(
          createResponse(true, { acknowledged: true, action: "ignored", reason: "missing_pass_id" }, undefined, requestId)
        );
      }

      const updateResult = await supabaseService.processPassUninstall(passKitId);

      if (!updateResult.success) {
        console.warn(`   ⚠️ Pass ${passKitId} not found in database: ${updateResult.error}`);
        return res.status(200).json(
          createResponse(true, { acknowledged: true, action: "not_found", passId: passKitId }, undefined, requestId)
        );
      }

      console.log(`   ✅ Churn recorded for Pass: ${passKitId} (UUID: ${updateResult.passUuid})`);

      return res.status(200).json(
        createResponse(
          true,
          {
            acknowledged: true,
            action: "processed",
            passId: passKitId,
            passUuid: updateResult.passUuid,
            transactionId: updateResult.transactionId,
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
          { acknowledged: true, action: "error", error: error instanceof Error ? error.message : "Unknown error" },
          undefined,
          requestId
        )
      );
    }
  }

  async handlePassKitEvent(req: Request, res: Response) {
    const requestId = (req.headers["x-request-id"] as string) || generate();
    
    try {
      const payload = req.body;
      
      console.log(`\n📩 [Webhook] Received Generic PassKit Event`);
      console.log(`   Payload:`, JSON.stringify(payload, null, 2));

      return res.status(200).json(
        createResponse(true, { acknowledged: true, event: payload.event || "unknown" }, undefined, requestId)
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
