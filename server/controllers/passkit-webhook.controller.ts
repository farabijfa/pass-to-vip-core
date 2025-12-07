import { Request, Response } from "express";
import crypto from "crypto";
import { config } from "../config";
import { supabaseService } from "../services/supabase.service";
import { passKitSyncService } from "../services/passkit-sync.service";

const verifyPassKitSignature = (req: Request): boolean => {
  const signature = req.headers["x-passkit-signature"];
  if (!signature || typeof signature !== "string") {
    return false;
  }

  const secret = config.passKit.apiSecret;
  if (!secret) {
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
  id?: string;
  programId?: string;
  tierId?: string;
  tierName?: string;
  timestamp?: string;
  points?: number;
  person?: {
    emailAddress?: string;
    forename?: string;
    surname?: string;
    mobileNumber?: string;
  };
  [key: string]: unknown;
}

export const handlePassKitWebhook = async (req: Request, res: Response) => {
  try {
    const signatureValid = verifyPassKitSignature(req);
    const secret = config.passKit.apiSecret;
    
    if (secret && !signatureValid) {
      console.warn("PassKit Webhook: Invalid signature - rejecting request");
      return res.status(401).json({ 
        error: "Unauthorized",
        message: "Invalid webhook signature" 
      });
    }
    
    if (!secret) {
      console.warn("PassKit Webhook: PASSKIT_API_SECRET not configured - accepting without verification (DEV MODE)");
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

    const client = supabaseService.getClient();
    const passkitInternalId = event.id || event.passId;
    const passkitProgramId = event.programId;

    if (eventType === "member.enrolled" || eventType === "pass.created" || eventType === "create") {
      console.log(`🆕 PassKit Webhook: NEW PASS CREATED`, {
        passkitInternalId,
        externalId: memberId,
        passkitProgramId,
        email: event.person?.emailAddress,
      });

      if (!passkitProgramId) {
        console.warn("PassKit Webhook: No programId in create event");
        return res.status(200).json({ 
          received: true, 
          warning: "No programId provided for pass creation" 
        });
      }

      const { data: program, error: programError } = await client
        .from("programs")
        .select("id, name")
        .eq("passkit_program_id", passkitProgramId)
        .single();

      if (programError || !program) {
        console.warn(`PassKit Webhook: Program not found for PassKit ID: ${passkitProgramId}`);
        return res.status(200).json({ 
          received: true, 
          warning: `Program not found for PassKit ID: ${passkitProgramId}` 
        });
      }

      console.log(`📍 Matched to program: ${program.name} (${program.id})`);

      const syncResult = await passKitSyncService.syncSinglePassFromWebhook(
        program.id,
        passkitProgramId,
        {
          id: passkitInternalId || memberId || "",
          externalId: memberId,
          programId: passkitProgramId,
          tierId: event.tierId,
          tierName: event.tierName,
          points: event.points,
          person: event.person,
        }
      );

      if (syncResult.success) {
        console.log(`✅ Auto-synced new pass to Supabase: ${memberId}`);
        return res.status(200).json({ 
          success: true, 
          message: "Pass auto-synced to database",
          memberId,
          action: syncResult.action,
        });
      } else {
        console.error(`❌ Failed to auto-sync pass: ${syncResult.error}`);
        return res.status(200).json({ 
          received: true, 
          error: `Sync failed: ${syncResult.error}`,
          memberId,
        });
      }
    }

    if (!memberId) {
      console.warn("PassKit Webhook: No member ID in event payload");
      return res.status(200).json({ 
        received: true, 
        warning: "No member ID provided" 
      });
    }

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
