import { Router } from "express";
import { notificationController } from "../controllers/notification.controller";
import { checkApiKey } from "../middleware/auth.middleware";

const router = Router();

router.post(
  "/broadcast",
  checkApiKey,
  notificationController.sendBroadcast.bind(notificationController)
);

router.post(
  "/birthday-run",
  checkApiKey,
  notificationController.runBirthdayBot.bind(notificationController)
);

router.get(
  "/birthday-bot/test",
  checkApiKey,
  notificationController.testBirthdayBot.bind(notificationController)
);

router.get(
  "/logs",
  checkApiKey,
  notificationController.getCampaignLogs.bind(notificationController)
);

export default router;
