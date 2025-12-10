import { Request, Response } from "express";
import crypto from "crypto";
import { config } from "../config";
import { supabaseService } from "../services/supabase.service";
import { passKitSyncService } from "../services/passkit-sync.service";

const verifyPassKitSignature = (req: Request): { valid: boolean; debug: string } => {
  // Access rawBody from the request (set by Express JSON middleware verify function)
  const rawBody = (req as any).rawBody;
  const signature = req.headers["x-passkit-signature"];
  
  if (!signature || typeof signature !== "string") {
    return { valid: false, debug: "No x-passkit-signature header" };
  }

  const secret = config.passKit.apiSecret;
  if (!secret) {
    return { valid: false, debug: "PASSKIT_API_SECRET not configured" };
  }

  try {
    const hmac = crypto.createHmac("sha256", secret);
    
    let bodyUsed = "unknown";
    if (Buffer.isBuffer(rawBody)) {
      hmac.update(rawBody);
      bodyUsed = `Buffer(${rawBody.length} bytes)`;
    } else if (typeof rawBody === "string") {
      hmac.update(rawBody);
      bodyUsed = `String(${rawBody.length} chars)`;
    } else {
      const jsonBody = JSON.stringify(req.body);
      hmac.update(jsonBody);
      bodyUsed = `JSON.stringify(${jsonBody.length} chars)`;
    }
    
    const digest = hmac.digest("hex");
    
    // Handle different signature formats (hex or base64)
    let isValid = false;
    try {
      isValid = crypto.timingSafeEqual(
        Buffer.from(signature, "hex"),
        Buffer.from(digest, "hex")
      );
    } catch {
      // Try base64 comparison
      try {
        const signatureHex = Buffer.from(signature, "base64").toString("hex");
        isValid = crypto.timingSafeEqual(
          Buffer.from(signatureHex, "hex"),
          Buffer.from(digest, "hex")
        );
      } catch {
        isValid = signature === digest;
      }
    }
    
    return { 
      valid: isValid, 
      debug: `Body: ${bodyUsed}, Digest: ${digest.substring(0, 16)}..., Sig: ${signature.substring(0, 16)}...` 
    };
  } catch (error) {
    return { valid: false, debug: `Error: ${error}` };
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
  // Log every incoming webhook for debugging
  console.log(`\n${"=".repeat(60)}`);
  console.log(`📥 PASSKIT WEBHOOK RECEIVED - ${new Date().toISOString()}`);
  console.log(`${"=".repeat(60)}`);
  console.log(`Headers:`, JSON.stringify({
    "x-passkit-signature": req.headers["x-passkit-signature"] ? "present" : "missing",
    "content-type": req.headers["content-type"],
  }));
  console.log(`Body:`, JSON.stringify(req.body, null, 2));
  
  try {
    const signatureResult = verifyPassKitSignature(req);
    const secret = config.passKit.apiSecret;
    
    console.log(`🔐 Signature Check:`, {
      valid: signatureResult.valid,
      debug: signatureResult.debug,
      secretConfigured: !!secret,
    });
    
    // Allow bypassing signature verification via environment variable for debugging
    const skipSignatureCheck = process.env.PASSKIT_WEBHOOK_SKIP_SIGNATURE === "true";
    
    if (secret && !signatureResult.valid && !skipSignatureCheck) {
      console.warn("❌ PassKit Webhook: Invalid signature - rejecting request");
      console.warn(`   Debug: ${signatureResult.debug}`);
      return res.status(401).json({ 
        error: "Unauthorized",
        message: "Invalid webhook signature",
        debug: signatureResult.debug,
      });
    }
    
    if (skipSignatureCheck && !signatureResult.valid) {
      console.warn("⚠️ PassKit Webhook: Signature invalid but PASSKIT_WEBHOOK_SKIP_SIGNATURE=true - ACCEPTING REQUEST FOR DEBUG");
    }
    
    if (!secret) {
      console.warn("⚠️ PassKit Webhook: PASSKIT_API_SECRET not configured - accepting without verification (DEV MODE)");
    }

    const event: PassKitWebhookEvent = req.body;
    const eventType = event.event || "unknown";
    const memberId = event.externalId || event.memberId;

    console.log(`📥 PassKit Webhook Event: ${eventType}`, {
      memberId,
      passId: event.passId,
      id: event.id,
      programId: event.programId,
      signatureValid: signatureResult.valid,
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

    // Enhanced logging for debugging uninstall payload structure
    console.log(`🔍 PAYLOAD IDENTIFIERS:`, {
      externalId: event.externalId || "NOT_PRESENT",
      memberId: event.memberId || "NOT_PRESENT",
      id: event.id || "NOT_PRESENT",
      passId: event.passId || "NOT_PRESENT",
      programId: event.programId || "NOT_PRESENT",
    });

    // Helper function for fallback lookup - tries external_id first, then passkit_id
    const updatePassWithFallback = async (
      updateData: Record<string, unknown>,
      logPrefix: string
    ): Promise<{ success: boolean; matchedBy: string; error?: string }> => {
      // Strategy 1: Try external_id (memberId from webhook)
      if (memberId) {
        const { data: data1, error: error1 } = await client
          .from("passes_master")
          .update(updateData)
          .eq("external_id", memberId)
          .select("id");

        if (!error1 && data1 && data1.length > 0) {
          console.log(`${logPrefix} ✅ Matched ${data1.length} row(s) by external_id: ${memberId}`);
          return { success: true, matchedBy: "external_id" };
        }
        if (error1) {
          console.warn(`${logPrefix} external_id lookup error: ${error1.message}`);
        } else {
          console.warn(`${logPrefix} external_id lookup: 0 rows matched for ${memberId}`);
        }
      }

      // Strategy 2: Try passkit_id (internal PassKit ID)
      if (passkitInternalId) {
        const { data: data2, error: error2 } = await client
          .from("passes_master")
          .update(updateData)
          .eq("passkit_id", passkitInternalId)
          .select("id");

        if (!error2 && data2 && data2.length > 0) {
          console.log(`${logPrefix} ✅ Matched ${data2.length} row(s) by passkit_id: ${passkitInternalId}`);
          return { success: true, matchedBy: "passkit_id" };
        }
        if (error2) {
          console.warn(`${logPrefix} passkit_id lookup error: ${error2.message}`);
        } else {
          console.warn(`${logPrefix} passkit_id lookup: 0 rows matched for ${passkitInternalId}`);
        }
      }

      // Strategy 3: Try id field as passkit_id
      if (event.id && event.id !== passkitInternalId) {
        const { data: data3, error: error3 } = await client
          .from("passes_master")
          .update(updateData)
          .eq("passkit_id", event.id)
          .select("id");

        if (!error3 && data3 && data3.length > 0) {
          console.log(`${logPrefix} ✅ Matched ${data3.length} row(s) by event.id as passkit_id: ${event.id}`);
          return { success: true, matchedBy: "event.id" };
        }
      }

      console.error(`${logPrefix} ❌ NO ROWS MATCHED with any identifier strategy`);
      return { success: false, matchedBy: "none", error: "No matching pass found in database" };
    };

    if (eventType === "pass.uninstalled" || eventType === "delete") {
      console.log(`🔴 UNINSTALL EVENT - attempting to mark pass as inactive`);
      
      const result = await updatePassWithFallback(
        {
          status: "UNINSTALLED",
          is_active: false,
          last_updated: new Date().toISOString(),
        },
        "🔴 UNINSTALL:"
      );

      if (result.success) {
        return res.status(200).json({ 
          success: true, 
          message: "Pass marked as UNINSTALLED",
          matchedBy: result.matchedBy,
          identifiers: { externalId: memberId, passkitId: passkitInternalId },
        });
      } else {
        return res.status(200).json({ 
          received: true, 
          warning: result.error,
          identifiers: { externalId: memberId, passkitId: passkitInternalId },
        });
      }
    }

    if (eventType === "pass.installed" || eventType === "install") {
      console.log(`🟢 INSTALL EVENT - attempting to mark pass as active`);
      
      const result = await updatePassWithFallback(
        {
          status: "INSTALLED",
          is_active: true,
          last_updated: new Date().toISOString(),
        },
        "🟢 INSTALL:"
      );

      if (result.success) {
        return res.status(200).json({ 
          success: true, 
          message: "Pass marked as INSTALLED",
          matchedBy: result.matchedBy,
          identifiers: { externalId: memberId, passkitId: passkitInternalId },
        });
      } else {
        return res.status(200).json({ 
          received: true, 
          warning: result.error,
          identifiers: { externalId: memberId, passkitId: passkitInternalId },
        });
      }
    }

    if (eventType === "pass.updated" || eventType === "update") {
      console.log(`🔵 UPDATE EVENT - updating last_updated timestamp`);
      
      const result = await updatePassWithFallback(
        {
          last_updated: new Date().toISOString(),
        },
        "🔵 UPDATE:"
      );

      return res.status(200).json({ 
        received: true, 
        message: "Pass update acknowledged",
        matchedBy: result.matchedBy,
        identifiers: { externalId: memberId, passkitId: passkitInternalId },
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
