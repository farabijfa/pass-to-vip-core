import { Router, Request, Response } from "express";
import { webhookController } from "../controllers/webhook.controller";
import { asyncHandler } from "../middleware/error.middleware";
import { 
  posApiKeyAuth, 
  POSAuthRequest,
  checkIdempotency,
  storeTransaction 
} from "../middleware/posAuth.middleware";
import { logicService } from "../services/logic.service";
import { getSupabaseClient, isSupabaseConfigured } from "../config/supabase";
import { generate } from "short-uuid";
import { posRateLimiter } from "../middleware/rateLimit.middleware";

const router = Router();

router.post(
  "/passkit/uninstall",
  asyncHandler(webhookController.handlePassKitUninstall.bind(webhookController))
);

router.post(
  "/passkit/event",
  asyncHandler(webhookController.handlePassKitEvent.bind(webhookController))
);

router.post(
  "/passkit/enrollment",
  asyncHandler(webhookController.handlePassKitEnrollment.bind(webhookController))
);

function createPosResponse<T>(
  success: boolean,
  data?: T,
  message?: string,
  error?: { code: string; message: string; details?: any },
  requestId?: string,
  processingTime?: number
) {
  return {
    success,
    message,
    data,
    error,
    metadata: {
      requestId: requestId || generate(),
      timestamp: new Date().toISOString(),
      processingTime,
    },
  };
}

async function lookupMemberByExternalId(externalId: string, programId?: string) {
  if (!isSupabaseConfigured()) {
    return { success: false, error: "Database not configured" };
  }

  try {
    const supabase = getSupabaseClient();

    let query = supabase
      .from("passes_master")
      .select(`
        id,
        external_id,
        status,
        is_active,
        enrollment_source,
        points_balance,
        spend_tier_level,
        member_email,
        member_first_name,
        member_last_name,
        program:programs!inner (
          id,
          name,
          is_suspended
        )
      `)
      .eq("external_id", externalId);

    if (programId) {
      query = query.eq("program_id", programId);
    }

    const { data, error } = await query.single();

    if (error) {
      return { success: false, error: "Member not found" };
    }

    const program = data.program as unknown as { id: string; name: string; is_suspended: boolean };

    return {
      success: true,
      member: {
        id: data.id,
        external_id: data.external_id,
        first_name: data.member_first_name || "",
        last_name: data.member_last_name || "",
        email: data.member_email || "",
        phone: null,
        points_balance: data.points_balance || 0,
        tier_name: data.spend_tier_level || "Standard",
        status: data.status || "UNKNOWN",
        enrollment_source: data.enrollment_source || "UNKNOWN",
        program_id: program.id,
        program_name: program.name,
        created_at: new Date().toISOString(),
      },
    };
  } catch (error) {
    return { success: false, error: "Lookup failed" };
  }
}

router.post("/pos/lookup", posRateLimiter, posApiKeyAuth, async (req: POSAuthRequest, res: Response) => {
  const requestId = (req.headers["x-request-id"] as string) || generate();
  const startTime = Date.now();

  try {
    const { externalId, scanCode } = req.body;
    const lookupId = externalId || scanCode;

    if (!lookupId) {
      return res.status(400).json(
        createPosResponse(false, undefined, undefined, {
          code: "VALIDATION_ERROR",
          message: "externalId or scanCode is required",
        }, requestId, Date.now() - startTime)
      );
    }

    const idempotencyKey = req.idempotencyKey;
    if (idempotencyKey && req.posApiKey) {
      const cached = await checkIdempotency(req.posApiKey.programId, idempotencyKey);
      if (cached.isDuplicate && cached.cachedResponse) {
        return res.status(200).json(cached.cachedResponse);
      }
    }

    const result = await lookupMemberByExternalId(lookupId, req.posApiKey?.programId);
    const processingTime = Date.now() - startTime;

    if (!result.success) {
      return res.status(404).json(
        createPosResponse(false, undefined, undefined, {
          code: "NOT_FOUND",
          message: result.error || "Member not found",
        }, requestId, processingTime)
      );
    }

    const response = createPosResponse(
      true,
      { member: result.member },
      "Member found",
      undefined,
      requestId,
      processingTime
    );

    if (req.posApiKey) {
      storeTransaction({
        programId: req.posApiKey.programId,
        idempotencyKey,
        action: "LOOKUP",
        externalId: lookupId,
        responseBody: response,
      });
    }

    return res.status(200).json(response);
  } catch (error) {
    console.error("[POS Webhook] Lookup error:", error);
    return res.status(500).json(
      createPosResponse(false, undefined, undefined, {
        code: "PROCESSING_ERROR",
        message: "Lookup failed",
      }, requestId, Date.now() - startTime)
    );
  }
});

router.post("/pos/earn", posRateLimiter, posApiKeyAuth, async (req: POSAuthRequest, res: Response) => {
  const requestId = (req.headers["x-request-id"] as string) || generate();
  const startTime = Date.now();

  try {
    const { externalId, points, transactionRef } = req.body;

    if (!externalId || points === undefined) {
      return res.status(400).json(
        createPosResponse(false, undefined, undefined, {
          code: "VALIDATION_ERROR",
          message: "externalId and points are required",
        }, requestId, Date.now() - startTime)
      );
    }

    const pointsNum = parseInt(String(points));
    if (isNaN(pointsNum) || pointsNum <= 0) {
      return res.status(400).json(
        createPosResponse(false, undefined, undefined, {
          code: "VALIDATION_ERROR",
          message: "Points must be a positive number",
        }, requestId, Date.now() - startTime)
      );
    }

    if (pointsNum > 100000) {
      return res.status(400).json(
        createPosResponse(false, undefined, undefined, {
          code: "VALIDATION_ERROR",
          message: "Points cannot exceed 100,000 per transaction",
        }, requestId, Date.now() - startTime)
      );
    }

    const idempotencyKey = req.idempotencyKey;
    if (idempotencyKey && req.posApiKey) {
      const cached = await checkIdempotency(req.posApiKey.programId, idempotencyKey);
      if (cached.isDuplicate && cached.cachedResponse) {
        console.log(`[POS Webhook] Returning cached response for idempotency key: ${idempotencyKey}`);
        return res.status(200).json(cached.cachedResponse);
      }
    }

    const result = await logicService.handlePosAction(externalId, "MEMBER_EARN", pointsNum);
    const processingTime = Date.now() - startTime;

    const responseData = {
      action: "EARN",
      externalId,
      pointsAdded: pointsNum,
      previousBalance: result.data?.previous_balance || 0,
      newBalance: result.data?.new_balance || pointsNum,
      transactionId: result.data?.transaction_id || `txn_${Date.now()}`,
      transactionRef: transactionRef || null,
      timestamp: new Date().toISOString(),
    };

    const response = createPosResponse(
      true,
      responseData,
      result.message,
      undefined,
      requestId,
      processingTime
    );

    if (req.posApiKey) {
      storeTransaction({
        programId: req.posApiKey.programId,
        idempotencyKey,
        action: "EARN",
        externalId,
        points: pointsNum,
        responseBody: response,
      });
    }

    return res.status(200).json(response);
  } catch (error) {
    console.error("[POS Webhook] Earn error:", error);
    return res.status(500).json(
      createPosResponse(false, undefined, undefined, {
        code: "PROCESSING_ERROR",
        message: error instanceof Error ? error.message : "Earn failed",
      }, requestId, Date.now() - startTime)
    );
  }
});

router.post("/pos/redeem", posRateLimiter, posApiKeyAuth, async (req: POSAuthRequest, res: Response) => {
  const requestId = (req.headers["x-request-id"] as string) || generate();
  const startTime = Date.now();

  try {
    const { externalId, points, transactionRef } = req.body;

    if (!externalId || points === undefined) {
      return res.status(400).json(
        createPosResponse(false, undefined, undefined, {
          code: "VALIDATION_ERROR",
          message: "externalId and points are required",
        }, requestId, Date.now() - startTime)
      );
    }

    const pointsNum = parseInt(String(points));
    if (isNaN(pointsNum) || pointsNum <= 0) {
      return res.status(400).json(
        createPosResponse(false, undefined, undefined, {
          code: "VALIDATION_ERROR",
          message: "Points must be a positive number",
        }, requestId, Date.now() - startTime)
      );
    }

    const idempotencyKey = req.idempotencyKey;
    if (idempotencyKey && req.posApiKey) {
      const cached = await checkIdempotency(req.posApiKey.programId, idempotencyKey);
      if (cached.isDuplicate && cached.cachedResponse) {
        console.log(`[POS Webhook] Returning cached response for idempotency key: ${idempotencyKey}`);
        return res.status(200).json(cached.cachedResponse);
      }
    }

    const memberResult = await lookupMemberByExternalId(externalId, req.posApiKey?.programId);
    if (!memberResult.success || !memberResult.member) {
      return res.status(404).json(
        createPosResponse(false, undefined, undefined, {
          code: "NOT_FOUND",
          message: "Member not found",
        }, requestId, Date.now() - startTime)
      );
    }

    if (pointsNum > memberResult.member.points_balance) {
      return res.status(400).json(
        createPosResponse(false, undefined, undefined, {
          code: "INSUFFICIENT_BALANCE",
          message: `Insufficient points. Available: ${memberResult.member.points_balance}`,
          details: {
            requested: pointsNum,
            available: memberResult.member.points_balance,
          },
        }, requestId, Date.now() - startTime)
      );
    }

    const result = await logicService.handlePosAction(externalId, "MEMBER_REDEEM", pointsNum);
    const processingTime = Date.now() - startTime;

    const responseData = {
      action: "REDEEM",
      externalId,
      pointsRedeemed: pointsNum,
      previousBalance: result.data?.previous_balance || memberResult.member.points_balance,
      newBalance: result.data?.new_balance || (memberResult.member.points_balance - pointsNum),
      transactionId: result.data?.transaction_id || `txn_${Date.now()}`,
      transactionRef: transactionRef || null,
      timestamp: new Date().toISOString(),
    };

    const response = createPosResponse(
      true,
      responseData,
      result.message,
      undefined,
      requestId,
      processingTime
    );

    if (req.posApiKey) {
      storeTransaction({
        programId: req.posApiKey.programId,
        idempotencyKey,
        action: "REDEEM",
        externalId,
        points: pointsNum,
        responseBody: response,
      });
    }

    return res.status(200).json(response);
  } catch (error) {
    console.error("[POS Webhook] Redeem error:", error);
    return res.status(500).json(
      createPosResponse(false, undefined, undefined, {
        code: "PROCESSING_ERROR",
        message: error instanceof Error ? error.message : "Redeem failed",
      }, requestId, Date.now() - startTime)
    );
  }
});

export default router;
