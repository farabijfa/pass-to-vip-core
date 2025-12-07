import { Router, Request, Response, NextFunction } from "express";
import { logicService, ActionType } from "../services/logic.service";
import { 
  posApiKeyAuth, 
  POSAuthRequest, 
  checkIdempotency, 
  storeTransaction 
} from "../middleware/posAuth.middleware";
import { getSupabaseClient, isSupabaseConfigured } from "../config/supabase";
import { generate } from "short-uuid";

const router = Router();

interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata: {
    requestId: string;
    timestamp: string;
    processingTime?: number;
  };
}

function createResponse<T>(
  success: boolean,
  data?: T,
  message?: string,
  error?: { code: string; message: string; details?: any },
  requestId?: string,
  processingTime?: number
): ApiResponse<T> {
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

async function lookupMemberByExternalId(lookupId: string): Promise<{
  success: boolean;
  member?: {
    id: string;
    external_id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
    points_balance: number;
    tier_name: string;
    status: string;
    enrollment_source: string;
    program_id: string;
    program_name: string;
    earn_rate_multiplier: number;
    created_at: string;
    passkit_internal_id?: string;
  };
  error?: string;
}> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: "Database not configured" };
  }

  try {
    const supabase = getSupabaseClient();

    const selectQuery = `
      id,
      external_id,
      status,
      is_active,
      enrollment_source,
      protocol,
      passkit_internal_id,
      points_balance,
      spend_tier_level,
      member_email,
      member_first_name,
      member_last_name,
      program:programs!inner (
        id,
        name,
        is_suspended,
        earn_rate_multiplier
      )
    `;

    // First try to find by external_id
    let { data, error } = await supabase
      .from("passes_master")
      .select(selectQuery)
      .eq("external_id", lookupId)
      .single();

    // If not found by external_id, try passkit_internal_id
    if (error || !data) {
      console.log("[POS Lookup] Not found by external_id, trying passkit_internal_id:", lookupId);
      const result = await supabase
        .from("passes_master")
        .select(selectQuery)
        .eq("passkit_internal_id", lookupId)
        .limit(1)
        .maybeSingle();
      
      data = result.data;
      error = result.error;
      
      if (result.data) {
        console.log("[POS Lookup] Found by passkit_internal_id:", lookupId, "external_id:", result.data.external_id);
      }
    }

    if (error || !data) {
      console.error("[POS Lookup] Error:", error?.message || "Not found by either external_id or passkit_internal_id");
      return { success: false, error: "Member not found" };
    }

    const program = data.program as unknown as { id: string; name: string; is_suspended: boolean; earn_rate_multiplier: number };

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
        earn_rate_multiplier: program.earn_rate_multiplier || 10,
        created_at: new Date().toISOString(),
        passkit_internal_id: data.passkit_internal_id || undefined,
      },
    };
  } catch (error) {
    console.error("[POS Lookup] Error:", error);
    return { success: false, error: "Lookup failed" };
  }
}

router.post("/lookup", async (req: Request, res: Response) => {
  const requestId = (req.headers["x-request-id"] as string) || generate();
  const startTime = Date.now();

  try {
    const { externalId, scanCode } = req.body;
    const lookupId = externalId || scanCode;

    if (!lookupId) {
      return res.status(400).json(
        createResponse(
          false,
          undefined,
          undefined,
          {
            code: "VALIDATION_ERROR",
            message: "externalId or scanCode is required",
          },
          requestId,
          Date.now() - startTime
        )
      );
    }

    const result = await lookupMemberByExternalId(lookupId);
    const processingTime = Date.now() - startTime;

    if (!result.success) {
      return res.status(404).json(
        createResponse(
          false,
          undefined,
          undefined,
          {
            code: "NOT_FOUND",
            message: result.error || "Member not found",
          },
          requestId,
          processingTime
        )
      );
    }

    return res.status(200).json(
      createResponse(
        true,
        { member: result.member },
        "Member found",
        undefined,
        requestId,
        processingTime
      )
    );
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error("[POS] Lookup error:", error);

    return res.status(500).json(
      createResponse(
        false,
        undefined,
        undefined,
        {
          code: "PROCESSING_ERROR",
          message: error instanceof Error ? error.message : "Lookup failed",
        },
        requestId,
        processingTime
      )
    );
  }
});

router.post("/earn", async (req: Request, res: Response) => {
  const requestId = (req.headers["x-request-id"] as string) || generate();
  const startTime = Date.now();

  try {
    const { externalId, points, transactionAmount, transactionRef, metadata } = req.body;

    // Validate: need externalId and either points or transactionAmount
    if (!externalId) {
      return res.status(400).json(
        createResponse(
          false,
          undefined,
          undefined,
          {
            code: "VALIDATION_ERROR",
            message: "externalId is required",
          },
          requestId,
          Date.now() - startTime
        )
      );
    }

    // Allow either points (direct) or transactionAmount (with multiplier)
    const hasPoints = points !== undefined && points !== null;
    const hasTransactionAmount = transactionAmount !== undefined && transactionAmount !== null;
    
    if (!hasPoints && !hasTransactionAmount) {
      return res.status(400).json(
        createResponse(
          false,
          undefined,
          undefined,
          {
            code: "VALIDATION_ERROR",
            message: "Either 'points' (direct) or 'transactionAmount' (currency) is required",
          },
          requestId,
          Date.now() - startTime
        )
      );
    }

    let pointsNum = 0;
    let txnAmount: number | undefined = undefined;

    if (hasTransactionAmount) {
      // Currency-based earning with multiplier
      txnAmount = parseFloat(String(transactionAmount));
      if (isNaN(txnAmount) || txnAmount <= 0) {
        return res.status(400).json(
          createResponse(
            false,
            undefined,
            undefined,
            {
              code: "VALIDATION_ERROR",
              message: "transactionAmount must be a positive number",
            },
            requestId,
            Date.now() - startTime
          )
        );
      }
      if (txnAmount > 1000000) {
        return res.status(400).json(
          createResponse(
            false,
            undefined,
            undefined,
            {
              code: "VALIDATION_ERROR",
              message: "transactionAmount cannot exceed 1,000,000",
            },
            requestId,
            Date.now() - startTime
          )
        );
      }
    } else {
      // Direct points earning
      pointsNum = parseInt(String(points));
      if (isNaN(pointsNum) || pointsNum <= 0) {
        return res.status(400).json(
          createResponse(
            false,
            undefined,
            undefined,
            {
              code: "VALIDATION_ERROR",
              message: "Points must be a positive number",
            },
            requestId,
            Date.now() - startTime
          )
        );
      }

      if (pointsNum > 100000) {
        return res.status(400).json(
          createResponse(
            false,
            undefined,
            undefined,
            {
              code: "VALIDATION_ERROR",
              message: "Points cannot exceed 100,000 per transaction",
            },
            requestId,
            Date.now() - startTime
          )
        );
      }
    }

    const result = await logicService.handlePosAction(externalId, "MEMBER_EARN", pointsNum, txnAmount);
    const processingTime = Date.now() - startTime;

    const responseData = {
      action: "EARN",
      externalId,
      pointsAdded: result.data?.points_processed || pointsNum,
      transactionAmount: result.data?.transaction_amount || txnAmount,
      multiplierUsed: result.data?.multiplier_used,
      previousBalance: result.data?.previous_balance || 0,
      newBalance: result.data?.new_balance || pointsNum,
      transactionId: result.data?.transaction_id || `txn_${Date.now()}`,
      transactionRef: transactionRef || null,
      timestamp: new Date().toISOString(),
      newTierName: result.data?.tier_level || null,
    };

    return res.status(200).json(
      createResponse(
        true,
        responseData,
        result.message,
        undefined,
        requestId,
        processingTime
      )
    );
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error("[POS] Earn error:", error);

    return res.status(500).json(
      createResponse(
        false,
        undefined,
        undefined,
        {
          code: "PROCESSING_ERROR",
          message: error instanceof Error ? error.message : "Earn failed",
        },
        requestId,
        processingTime
      )
    );
  }
});

router.post("/redeem", async (req: Request, res: Response) => {
  const requestId = (req.headers["x-request-id"] as string) || generate();
  const startTime = Date.now();

  try {
    const { externalId, points, transactionRef, metadata } = req.body;

    if (!externalId || points === undefined) {
      return res.status(400).json(
        createResponse(
          false,
          undefined,
          undefined,
          {
            code: "VALIDATION_ERROR",
            message: "externalId and points are required",
          },
          requestId,
          Date.now() - startTime
        )
      );
    }

    const pointsNum = parseInt(String(points));
    if (isNaN(pointsNum) || pointsNum <= 0) {
      return res.status(400).json(
        createResponse(
          false,
          undefined,
          undefined,
          {
            code: "VALIDATION_ERROR",
            message: "Points must be a positive number",
          },
          requestId,
          Date.now() - startTime
        )
      );
    }

    const memberResult = await lookupMemberByExternalId(externalId);
    if (!memberResult.success || !memberResult.member) {
      return res.status(404).json(
        createResponse(
          false,
          undefined,
          undefined,
          {
            code: "NOT_FOUND",
            message: "Member not found",
          },
          requestId,
          Date.now() - startTime
        )
      );
    }

    if (pointsNum > memberResult.member.points_balance) {
      return res.status(400).json(
        createResponse(
          false,
          undefined,
          undefined,
          {
            code: "INSUFFICIENT_BALANCE",
            message: `Insufficient points. Available: ${memberResult.member.points_balance}`,
            details: {
              requested: pointsNum,
              available: memberResult.member.points_balance,
            },
          },
          requestId,
          Date.now() - startTime
        )
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

    return res.status(200).json(
      createResponse(
        true,
        responseData,
        result.message,
        undefined,
        requestId,
        processingTime
      )
    );
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error("[POS] Redeem error:", error);

    const errorMessage = error instanceof Error ? error.message : "Redeem failed";
    
    // Gap F: Handle INSUFFICIENT_FUNDS from atomic RPC with proper status code
    if (errorMessage.includes("Insufficient balance")) {
      return res.status(400).json(
        createResponse(
          false,
          undefined,
          undefined,
          {
            code: "INSUFFICIENT_BALANCE",
            message: errorMessage,
          },
          requestId,
          processingTime
        )
      );
    }

    // Handle program suspension
    if (errorMessage.includes("Program Suspended")) {
      return res.status(403).json(
        createResponse(
          false,
          undefined,
          undefined,
          {
            code: "PROGRAM_SUSPENDED",
            message: errorMessage,
          },
          requestId,
          processingTime
        )
      );
    }

    return res.status(500).json(
      createResponse(
        false,
        undefined,
        undefined,
        {
          code: "PROCESSING_ERROR",
          message: errorMessage,
        },
        requestId,
        processingTime
      )
    );
  }
});

router.get("/lookup/:externalId", async (req: Request, res: Response) => {
  const requestId = (req.headers["x-request-id"] as string) || generate();
  const startTime = Date.now();

  try {
    const { externalId } = req.params;

    if (!externalId) {
      return res.status(400).json(
        createResponse(
          false,
          undefined,
          undefined,
          {
            code: "VALIDATION_ERROR",
            message: "External ID is required",
          },
          requestId,
          Date.now() - startTime
        )
      );
    }

    const result = await lookupMemberByExternalId(externalId);
    const processingTime = Date.now() - startTime;

    if (!result.success) {
      return res.status(404).json(
        createResponse(
          false,
          undefined,
          undefined,
          {
            code: "NOT_FOUND",
            message: result.error || "Member not found",
          },
          requestId,
          processingTime
        )
      );
    }

    return res.status(200).json(
      createResponse(
        true,
        { member: result.member },
        "Member found",
        undefined,
        requestId,
        processingTime
      )
    );
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error("[POS] Lookup error:", error);

    return res.status(500).json(
      createResponse(
        false,
        undefined,
        undefined,
        {
          code: "PROCESSING_ERROR",
          message: error instanceof Error ? error.message : "Lookup failed",
        },
        requestId,
        processingTime
      )
    );
  }
});

router.post("/action", async (req: Request, res: Response, next: NextFunction) => {
  const requestId = (req.headers["x-request-id"] as string) || generate();
  const startTime = Date.now();

  try {
    const { external_id, action, amount } = req.body;

    if (!external_id || !action) {
      return res.status(400).json(
        createResponse(
          false,
          undefined,
          undefined,
          {
            code: "VALIDATION_ERROR",
            message: "Missing required fields: external_id and action are required.",
            details: {
              received: { external_id: !!external_id, action: !!action },
            },
          },
          requestId,
          Date.now() - startTime
        )
      );
    }

    if (!logicService.isValidAction(action)) {
      return res.status(400).json(
        createResponse(
          false,
          undefined,
          undefined,
          {
            code: "INVALID_ACTION",
            message: `Invalid action type: ${action}`,
            details: {
              validActions: logicService.getAvailableActions(),
            },
          },
          requestId,
          Date.now() - startTime
        )
      );
    }

    const result = await logicService.handlePosAction(
      external_id,
      action as ActionType,
      amount
    );

    const processingTime = Date.now() - startTime;

    return res.status(200).json(
      createResponse(
        true,
        result.data,
        result.message,
        undefined,
        requestId,
        processingTime
      )
    );
  } catch (error) {
    const processingTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Internal Server Error";

    console.error(`[POS] Error processing action:`, error);

    return res.status(500).json(
      createResponse(
        false,
        undefined,
        undefined,
        {
          code: "PROCESSING_ERROR",
          message: errorMessage,
        },
        requestId,
        processingTime
      )
    );
  }
});

router.get("/actions", (_req: Request, res: Response) => {
  const requestId = generate();

  res.status(200).json(
    createResponse(
      true,
      {
        endpoints: {
          lookup: {
            method: "POST",
            path: "/api/pos/lookup",
            description: "Look up member by external ID or scan code. Returns earn_rate_multiplier for point calculations.",
            body: { externalId: "string", scanCode: "string (alternative)" },
            response: { member: { earn_rate_multiplier: "number (default 10)" } },
          },
          earn: {
            method: "POST",
            path: "/api/pos/earn",
            description: "Add points to member balance. Use EITHER points (direct) OR transactionAmount (currency-based with multiplier).",
            body: { 
              externalId: "string (required)", 
              points: "number (direct points, optional)", 
              transactionAmount: "number (currency amount, applies multiplier, optional)",
              transactionRef: "string (optional)" 
            },
            examples: [
              { description: "Direct points", body: { externalId: "PUB-123", points: 100 } },
              { description: "Currency-based (10x multiplier)", body: { externalId: "PUB-123", transactionAmount: 12.50 }, result: "125 points" },
            ],
          },
          redeem: {
            method: "POST",
            path: "/api/pos/redeem",
            description: "Redeem points from member balance",
            body: { externalId: "string", points: "number", transactionRef: "string (optional)" },
          },
        },
        pointSystem: {
          description: "Currency-to-points conversion uses configurable earn_rate_multiplier per program",
          formula: "points = floor(transactionAmount * earn_rate_multiplier)",
          defaultMultiplier: 10,
          examples: [
            { amount: 12.50, multiplier: 10, points: 125 },
            { amount: 12.99, multiplier: 10, points: 129 },
            { amount: 1000, multiplier: 1, points: 1000, note: "Japan (Yen)" },
          ],
        },
        webhookEndpoints: {
          lookup: "POST /api/webhooks/pos/lookup",
          earn: "POST /api/webhooks/pos/earn",
          redeem: "POST /api/webhooks/pos/redeem",
          description: "Webhook endpoints require x-api-key header for authentication",
        },
        membershipActions: ["MEMBER_EARN", "MEMBER_REDEEM", "MEMBER_ADJUST"],
        responseFormat: {
          success: "boolean",
          data: "object",
          error: "{ code: string, message: string }",
          metadata: "{ requestId: string, timestamp: string, processingTime: number }",
        },
      },
      "POS Integration API Reference",
      undefined,
      requestId
    )
  );
});

export default router;
