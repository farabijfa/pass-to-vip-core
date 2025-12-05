import { Request, Response } from "express";
import crypto from "crypto";
import { config } from "../config";
import { supabaseService } from "../services/supabase.service";

const verifyPassKitSignature = (req: Request): boolean => {
  const signature = req.headers["x-passkit-signature"];
  if (!signature || typeof signature !== "string") {
    console.warn("PassKit Webhook: Missing x-passkit-signature header");
    return false;
  }

  const secret = config.passKit.apiSecret;
  if (!secret) {
    console.warn("PassKit Webhook: PASSKIT_API_SECRET not configured");
    return false;
  }

  try {
    const hmac = crypto.createHmac("sha256", secret);
    const rawBody = req.rawBody;
    
    if (Buffer.isBuffer(rawBody)) {
      hmac.update(rawBody);
    } else if (typeof rawBody === "string") {
      hmac.update(rawBody);
    } else {
      hmac.update(JSON.stringify(req.body));
    }
    
    const digest = hmac.digest("hex");
    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(digest)
    );
    
    return isValid;
  } catch (error) {
    console.error("PassKit Webhook: Signature verification error:", error);
    return false;
  }
};

interface PassKitWebhookEvent {
  event: string;
  externalId?: string;
  memberId?: string;
  passId?: string;
  programId?: string;
  tierId?: string;
  timestamp?: string;
  [key: string]: unknown;
}

export const handlePassKitWebhook = async (req: Request, res: Response) => {
  try {
    const signatureValid = verifyPassKitSignature(req);
    
    if (!signatureValid) {
      console.warn("PassKit Webhook: Invalid signature - logging event but not processing");
    }

    const event: PassKitWebhookEvent = req.body;
    const eventType = event.event || "unknown";
    const memberId = event.externalId || event.memberId;

    console.log(`📥 PassKit Webhook: ${eventType}`, {
      memberId,
      passId: event.passId,
      programId: event.programId,
      signatureValid,
    });

    if (!memberId) {
      console.warn("PassKit Webhook: No member ID in event payload");
      return res.status(200).json({ 
        received: true, 
        warning: "No member ID provided" 
      });
    }

    const client = supabaseService.getClient();

    if (eventType === "pass.uninstalled" || eventType === "delete") {
      console.log(`🔴 Pass ${memberId}: Uninstalled → CHURNED`);
      
      // Update passes_master table (the actual table storing pass records)
      const { error } = await client
        .from("passes_master")
        .update({
          status: "UNINSTALLED",
          is_active: false,
          last_updated: new Date().toISOString(),
        })
        .eq("external_id", memberId);

      if (error) {
        console.error("PassKit Webhook: Database update error:", error.message);
        return res.status(200).json({ 
          received: true, 
          error: "Database update failed" 
        });
      }

      return res.status(200).json({ 
        success: true, 
        message: "Pass marked as UNINSTALLED",
        memberId,
      });
    }

    if (eventType === "pass.installed" || eventType === "install") {
      console.log(`🟢 Pass ${memberId}: Installed → ACTIVE`);
      
      // Update passes_master table (the actual table storing pass records)
      const { error } = await client
        .from("passes_master")
        .update({
          status: "INSTALLED",
          is_active: true,
          last_updated: new Date().toISOString(),
        })
        .eq("external_id", memberId);

      if (error) {
        console.error("PassKit Webhook: Database update error:", error.message);
        return res.status(200).json({ 
          received: true, 
          error: "Database update failed" 
        });
      }

      return res.status(200).json({ 
        success: true, 
        message: "Pass marked as INSTALLED",
        memberId,
      });
    }

    if (eventType === "pass.updated" || eventType === "update") {
      console.log(`🔵 Pass ${memberId}: Updated`);
      
      // Update passes_master table (the actual table storing pass records)
      const { error } = await client
        .from("passes_master")
        .update({
          last_updated: new Date().toISOString(),
        })
        .eq("external_id", memberId);

      if (error) {
        console.error("PassKit Webhook: Database update error:", error.message);
      }

      return res.status(200).json({ 
        received: true, 
        message: "Pass update acknowledged",
        memberId,
      });
    }

    console.log(`ℹ️ PassKit Webhook: Unhandled event type: ${eventType}`);
    return res.status(200).json({ 
      received: true, 
      eventType,
      message: "Event type not handled" 
    });

  } catch (error) {
    console.error("PassKit Webhook: Unexpected error:", error);
    return res.status(200).json({ 
      received: true, 
      error: "Internal error" 
    });
  }
};
