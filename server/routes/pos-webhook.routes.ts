/**
 * POS Webhook Routes (v2.6.0)
 * 
 * External POS integration endpoints for spend-based tier calculation.
 * All routes require API key authentication via x-api-key header.
 * 
 * Endpoints:
 * - POST /api/pos/transactions - Process purchase transaction
 * - GET /api/pos/members/:externalId - Lookup member by external ID
 * - GET /api/pos/health - Health check
 */

import { Router } from "express";
import { posWebhookController } from "../controllers/pos-webhook.controller";
import { posApiKeyAuth } from "../middleware/posAuth.middleware";
import rateLimit from "express-rate-limit";

const router = Router();

const posRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: {
    success: false,
    error: {
      code: "RATE_LIMITED",
      message: "Too many requests. Please try again later.",
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.get("/health", posWebhookController.healthCheck);

router.post(
  "/transactions",
  posRateLimiter,
  posApiKeyAuth,
  posWebhookController.processTransaction.bind(posWebhookController)
);

router.get(
  "/members/:externalId",
  posRateLimiter,
  posApiKeyAuth,
  posWebhookController.getMember.bind(posWebhookController)
);

export default router;
