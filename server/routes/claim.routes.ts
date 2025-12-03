import { Router } from "express";
import { claimController } from "../controllers/claim.controller";
import { validateClaimCode } from "../middleware";
import { asyncHandler } from "../middleware/error.middleware";

const router = Router();

router.get(
  "/:id",
  validateClaimCode,
  asyncHandler(claimController.handleClaim.bind(claimController))
);

router.get(
  "/:id/status",
  validateClaimCode,
  asyncHandler(claimController.getClaimStatus.bind(claimController))
);

export default router;
