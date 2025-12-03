import { Router } from "express";
import { passKitController } from "../controllers";
import {
  validatePassKitPass,
  validatePassKitUpdate,
  validateSerialNumber,
  validatePushNotification
} from "../middleware";
import { asyncHandler } from "../middleware/error.middleware";

const router = Router();

router.post(
  "/passes",
  validatePassKitPass,
  asyncHandler(passKitController.createPass.bind(passKitController))
);

router.get(
  "/passes/:serialNumber",
  validateSerialNumber,
  asyncHandler(passKitController.getPass.bind(passKitController))
);

router.patch(
  "/passes/:serialNumber",
  validatePassKitUpdate,
  asyncHandler(passKitController.updatePass.bind(passKitController))
);

router.delete(
  "/passes/:serialNumber",
  validateSerialNumber,
  asyncHandler(passKitController.deletePass.bind(passKitController))
);

router.post(
  "/passes/:serialNumber/push",
  validatePushNotification,
  asyncHandler(passKitController.sendPushNotification.bind(passKitController))
);

export default router;
