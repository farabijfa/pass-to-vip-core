import type { Request, Response, NextFunction } from "express";
import { supabaseService, passKitService, postGridService } from "../services";
import type { 
  MembershipTransaction, 
  OneTimeUse, 
  PostGridMail,
  PassKitPass,
  PassKitUpdate,
  ApiResponse 
} from "@shared/schema";
import { randomUUID } from "crypto";

function createResponse<T>(
  success: boolean,
  data?: T,
  error?: { code: string; message: string; details?: any },
  requestId?: string
): ApiResponse<T> {
  return {
    success,
    data,
    error,
    metadata: {
      requestId: requestId || randomUUID(),
      timestamp: new Date().toISOString(),
    },
  };
}

export class LoyaltyController {
  async processMembershipTransaction(req: Request, res: Response, next: NextFunction) {
    const requestId = (req.headers["x-request-id"] as string) || randomUUID();
    const startTime = Date.now();

    try {
      const transactionData: MembershipTransaction = req.body;

      const result = await supabaseService.processMembershipTransaction(transactionData);

      if (!result.success) {
        return res.status(400).json(
          createResponse(
            false,
            undefined,
            {
              code: "TRANSACTION_FAILED",
              message: result.error || "Failed to process membership transaction",
            },
            requestId
          )
        );
      }

      if (transactionData.passSerialNumber) {
        try {
          await passKitService.updatePass({
            serialNumber: transactionData.passSerialNumber,
            updates: {
              pointsBalance: result.newBalance,
            },
          });
        } catch (passError) {
          console.warn("Failed to update digital wallet pass:", passError);
        }
      }

      const response = createResponse(
        true,
        {
          transactionId: result.transactionId,
          newBalance: result.newBalance,
          previousBalance: result.previousBalance,
          pointsChange: transactionData.points * (transactionData.transactionType === "redeem" ? -1 : 1),
          transactionType: transactionData.transactionType,
        },
        undefined,
        requestId
      );

      response.metadata!.processingTime = Date.now() - startTime;

      return res.status(200).json(response);
    } catch (error) {
      console.error("Membership transaction error:", error);
      return res.status(500).json(
        createResponse(
          false,
          undefined,
          {
            code: "INTERNAL_ERROR",
            message: "An unexpected error occurred while processing the transaction",
          },
          requestId
        )
      );
    }
  }

  async processOneTimeUse(req: Request, res: Response, next: NextFunction) {
    const requestId = (req.headers["x-request-id"] as string) || randomUUID();
    const startTime = Date.now();

    try {
      const oneTimeUseData: OneTimeUse = req.body;

      const result = await supabaseService.processOneTimeUse(oneTimeUseData);

      if (!result.success) {
        return res.status(400).json(
          createResponse(
            false,
            undefined,
            {
              code: "REDEMPTION_FAILED",
              message: result.error || "Failed to process one-time use",
            },
            requestId
          )
        );
      }

      const response = createResponse(
        true,
        {
          redemptionId: result.redemptionId,
          offerDetails: result.offerDetails,
          redeemedAt: new Date().toISOString(),
        },
        undefined,
        requestId
      );

      response.metadata!.processingTime = Date.now() - startTime;

      return res.status(200).json(response);
    } catch (error) {
      console.error("One-time use error:", error);
      return res.status(500).json(
        createResponse(
          false,
          undefined,
          {
            code: "INTERNAL_ERROR",
            message: "An unexpected error occurred while processing the redemption",
          },
          requestId
        )
      );
    }
  }

  async getMemberBalance(req: Request, res: Response, next: NextFunction) {
    const requestId = (req.headers["x-request-id"] as string) || randomUUID();

    try {
      const { memberId } = req.params;

      if (!memberId) {
        return res.status(400).json(
          createResponse(
            false,
            undefined,
            {
              code: "INVALID_REQUEST",
              message: "Member ID is required",
            },
            requestId
          )
        );
      }

      const result = await supabaseService.getMemberBalance(memberId);

      if (!result) {
        return res.status(404).json(
          createResponse(
            false,
            undefined,
            {
              code: "MEMBER_NOT_FOUND",
              message: "Member not found or unable to retrieve balance",
            },
            requestId
          )
        );
      }

      return res.status(200).json(
        createResponse(
          true,
          {
            memberId,
            balance: result.balance,
            retrievedAt: new Date().toISOString(),
          },
          undefined,
          requestId
        )
      );
    } catch (error) {
      console.error("Get balance error:", error);
      return res.status(500).json(
        createResponse(
          false,
          undefined,
          {
            code: "INTERNAL_ERROR",
            message: "An unexpected error occurred while retrieving balance",
          },
          requestId
        )
      );
    }
  }

  async getMemberTransactionHistory(req: Request, res: Response, next: NextFunction) {
    const requestId = (req.headers["x-request-id"] as string) || randomUUID();

    try {
      const { memberId } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      if (!memberId) {
        return res.status(400).json(
          createResponse(
            false,
            undefined,
            {
              code: "INVALID_REQUEST",
              message: "Member ID is required",
            },
            requestId
          )
        );
      }

      const transactions = await supabaseService.getMemberTransactionHistory(memberId, limit, offset);

      return res.status(200).json(
        createResponse(
          true,
          {
            memberId,
            transactions,
            pagination: {
              limit,
              offset,
              count: transactions.length,
            },
          },
          undefined,
          requestId
        )
      );
    } catch (error) {
      console.error("Get transaction history error:", error);
      return res.status(500).json(
        createResponse(
          false,
          undefined,
          {
            code: "INTERNAL_ERROR",
            message: "An unexpected error occurred while retrieving transaction history",
          },
          requestId
        )
      );
    }
  }
}

export const loyaltyController = new LoyaltyController();
