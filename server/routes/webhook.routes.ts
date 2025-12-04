import { Router } from "express";
import { webhookController } from "../controllers/webhook.controller";
import { asyncHandler } from "../middleware/error.middleware";

const router = Router();

router.post(
  "/passkit/uninstall",
  asyncHandler(webhookController.handlePassKitUninstall.bind(webhookController))
);

router.post(
  "/passkit/event",
  asyncHandler(webhookController.handlePassKitEvent.bind(webhookController))
);

export default router;
