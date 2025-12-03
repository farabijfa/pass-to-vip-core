import { Router } from "express";
import { postGridController } from "../controllers";
import { validatePostGridMail, validateMailId, validateBatchCampaign } from "../middleware";
import { asyncHandler } from "../middleware/error.middleware";

const router = Router();

router.post(
  "/mail",
  validatePostGridMail,
  asyncHandler(postGridController.sendDirectMail.bind(postGridController))
);

router.get(
  "/mail/:mailId",
  validateMailId,
  asyncHandler(postGridController.getMailStatus.bind(postGridController))
);

router.delete(
  "/mail/:mailId",
  validateMailId,
  asyncHandler(postGridController.cancelMail.bind(postGridController))
);

router.get(
  "/templates",
  asyncHandler(postGridController.listTemplates.bind(postGridController))
);

router.post(
  "/campaign",
  validateBatchCampaign,
  asyncHandler(postGridController.sendBatchCampaign.bind(postGridController))
);

export default router;
