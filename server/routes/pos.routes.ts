import { Router, Request, Response, NextFunction } from "express";
import { logicService, ActionType } from "../services/logic.service";
import { generate } from "short-uuid";

const router = Router();

interface PosActionRequest {
  external_id: string;
  action: string;
  amount?: number;
}

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

router.post("/action", async (req: Request, res: Response, next: NextFunction) => {
  const requestId = (req.headers["x-request-id"] as string) || generate();
  const startTime = Date.now();

  try {
    const { external_id, action, amount }: PosActionRequest = req.body;

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
        membershipActions: ["MEMBER_EARN", "MEMBER_REDEEM", "MEMBER_ADJUST"],
        oneTimeActions: ["COUPON_REDEEM", "TICKET_CHECKIN", "INSTALL", "UNINSTALL"],
      },
      "Available POS actions",
      undefined,
      requestId
    )
  );
});

export default router;
