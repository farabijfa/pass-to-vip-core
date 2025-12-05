/**
 * POS Webhook Controller (v2.6.0)
 * 
 * Handles external POS transaction webhooks for spend-based tier calculation.
 * Authenticated via API key (x-api-key header) with rate limiting.
 */

import { Request, Response, NextFunction } from "express";
import { generate } from "short-uuid";
import { posWebhookService } from "../services/pos-webhook.service";
import { posWebhookTransactionSchema } from "@shared/schema";
import { POSAuthRequest } from "../middleware/posAuth.middleware";

interface WebhookRequest extends POSAuthRequest {
  body: any;
}

function createResponse(
  success: boolean,
  data?: any,
  error?: { code: string; message: string },
  requestId?: string
) {
  return {
    success,
    ...(data && { data }),
    ...(error && { error }),
    metadata: {
      requestId: requestId || generate(),
      timestamp: new Date().toISOString(),
    },
  };
}

export class POSWebhookController {
  /**
   * POST /api/pos/transactions
   * Process a purchase transaction from external POS
   * 
   * Headers:
   * - x-api-key: Program API key (required)
   * - idempotency-key: Prevent duplicate processing (optional but recommended)
   * 
   * Body:
   * {
   *   "externalMemberId": "LEVI-CUST-12345",
   *   "amountCents": 35000,
   *   "currency": "USD",
   *   "customerEmail": "customer@example.com",
   *   "customerFirstName": "John",
   *   "customerLastName": "Doe",
   *   "transactionId": "TXN-123456",
   *   "storeId": "STORE-001",
   *   "metadata": { "register": "POS-1", "cashier": "Jane" }
   * }
   * 
   * Response:
   * {
   *   "success": true,
   *   "data": {
   *     "memberId": "uuid",
   *     "tierLevel": "TIER_2",
   *     "tierName": "Silver",
   *     "discountPercent": 5,
   *     "spendTotalCents": 35000,
   *     "passUrl": "https://...",
   *     "isNewMember": true,
   *     "tierUpgraded": true,
   *     "previousTier": "Bronze"
   *   }
   * }
   */
  async processTransaction(req: WebhookRequest, res: Response, next: NextFunction) {
    const requestId = (req.headers["x-request-id"] as string) || generate();
    const startTime = Date.now();

    try {
      if (!req.posApiKey) {
        return res.status(401).json(
          createResponse(false, undefined, {
            code: "UNAUTHORIZED",
            message: "API key authentication required",
          }, requestId)
        );
      }

      const validation = posWebhookTransactionSchema.safeParse(req.body);
      if (!validation.success) {
        const errors = validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
        return res.status(400).json(
          createResponse(false, undefined, {
            code: "VALIDATION_ERROR",
            message: errors.join("; "),
          }, requestId)
        );
      }

      const result = await posWebhookService.processTransaction(
        req.posApiKey.programId,
        validation.data,
        req.idempotencyKey
      );

      const processingTime = Date.now() - startTime;

      if (!result.success) {
        console.log(`[POS Webhook] Transaction failed (${processingTime}ms):`, result.error);
        return res.status(400).json(
          createResponse(false, undefined, result.error, requestId)
        );
      }

      console.log(`[POS Webhook] Transaction success (${processingTime}ms):`, {
        memberId: result.memberId,
        tier: result.tierName,
        upgraded: result.tierUpgraded,
      });

      return res.status(200).json({
        success: true,
        data: {
          memberId: result.memberId,
          externalMemberId: result.externalMemberId,
          tierLevel: result.tierLevel,
          tierName: result.tierName,
          discountPercent: result.discountPercent,
          spendTotalCents: result.spendTotalCents,
          passUrl: result.passUrl,
          isNewMember: result.isNewMember,
          tierUpgraded: result.tierUpgraded,
          previousTier: result.previousTier,
          transactionId: result.transactionId,
        },
        metadata: {
          requestId,
          timestamp: new Date().toISOString(),
          processingTime,
        },
      });
    } catch (error) {
      console.error("[POS Webhook] Controller error:", error);
      return res.status(500).json(
        createResponse(false, undefined, {
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred",
        }, requestId)
      );
    }
  }

  /**
   * GET /api/pos/members/:externalId
   * Lookup member by external ID
   * 
   * Response includes current tier and discount information
   */
  async getMember(req: WebhookRequest, res: Response, next: NextFunction) {
    const requestId = (req.headers["x-request-id"] as string) || generate();

    try {
      if (!req.posApiKey) {
        return res.status(401).json(
          createResponse(false, undefined, {
            code: "UNAUTHORIZED",
            message: "API key authentication required",
          }, requestId)
        );
      }

      const { externalId } = req.params;
      if (!externalId) {
        return res.status(400).json(
          createResponse(false, undefined, {
            code: "MISSING_PARAMETER",
            message: "External member ID is required",
          }, requestId)
        );
      }

      const result = await posWebhookService.getMemberSpendSummary(
        req.posApiKey.programId,
        externalId
      );

      if (!result.found) {
        return res.status(404).json(
          createResponse(false, undefined, {
            code: "MEMBER_NOT_FOUND",
            message: "Member not found with the provided external ID",
          }, requestId)
        );
      }

      return res.status(200).json({
        success: true,
        data: result.member,
        metadata: {
          requestId,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error("[POS Webhook] Get member error:", error);
      return res.status(500).json(
        createResponse(false, undefined, {
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred",
        }, requestId)
      );
    }
  }

  /**
   * GET /api/pos/health
   * Health check endpoint for external POS systems
   */
  async healthCheck(req: Request, res: Response) {
    const requestId = generate();

    return res.status(200).json({
      success: true,
      data: {
        status: "healthy",
        service: "pos-webhook",
        version: "2.6.0",
      },
      metadata: {
        requestId,
        timestamp: new Date().toISOString(),
      },
    });
  }
}

export const posWebhookController = new POSWebhookController();
