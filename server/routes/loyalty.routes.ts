import { Router } from "express";
import { loyaltyController } from "../controllers";
import { 
  validateMembershipTransaction,
  validateOneTimeUse,
  validateMemberId,
  validatePaginationQuery
} from "../middleware";
import { asyncHandler } from "../middleware/error.middleware";

const router = Router();

router.post(
  "/membership",
  validateMembershipTransaction,
  asyncHandler(loyaltyController.processMembershipTransaction.bind(loyaltyController))
);

router.post(
  "/one-time-use",
  validateOneTimeUse,
  asyncHandler(loyaltyController.processOneTimeUse.bind(loyaltyController))
);

router.get(
  "/members/:memberId/balance",
  validateMemberId,
  asyncHandler(loyaltyController.getMemberBalance.bind(loyaltyController))
);

router.get(
  "/members/:memberId/transactions",
  validateMemberId,
  validatePaginationQuery,
  asyncHandler(loyaltyController.getMemberTransactionHistory.bind(loyaltyController))
);

export default router;
