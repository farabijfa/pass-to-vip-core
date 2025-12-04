import { Router } from "express";
import { healthController } from "../controllers";
import { asyncHandler } from "../middleware/error.middleware";

const router = Router();

router.get(
  "/",
  asyncHandler(healthController.getHealth.bind(healthController))
);

router.get(
  "/deep",
  asyncHandler(healthController.getHealth.bind(healthController))
);

router.get(
  "/ready",
  asyncHandler(healthController.getReadiness.bind(healthController))
);

router.get(
  "/live",
  asyncHandler(healthController.getLiveness.bind(healthController))
);

export default router;
