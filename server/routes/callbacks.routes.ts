import { Router } from "express";
import { handlePassKitWebhook } from "../controllers/passkit-webhook.controller";

const router = Router();

router.post("/passkit", handlePassKitWebhook);

export default router;
