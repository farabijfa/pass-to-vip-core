import { Router } from "express";
import loyaltyRoutes from "./loyalty.routes";
import passKitRoutes from "./passkit.routes";
import postGridRoutes from "./postgrid.routes";
import healthRoutes from "./health.routes";
import posRoutes from "./pos.routes";
import campaignRoutes from "./campaign.routes";
import adminRoutes from "./admin.routes";
import notificationRoutes from "./notification.routes";
import claimRoutes from "./claim.routes";
import webhookRoutes from "./webhook.routes";
import programsRoutes from "./programs.routes";
import customersRoutes from "./customers.routes";
import { posRateLimiter, notifyRateLimiter } from "../middleware";

const router = Router();

router.use("/pos", posRateLimiter, posRoutes);

router.use("/loyalty", loyaltyRoutes);

router.use("/wallet", passKitRoutes);

router.use("/mail", postGridRoutes);

router.use("/health", healthRoutes);

router.use("/campaign", campaignRoutes);

router.use("/admin", adminRoutes);

router.use("/notify", notifyRateLimiter, notificationRoutes);

router.use("/claim", claimRoutes);

router.use("/webhooks", webhookRoutes);

router.use("/programs", programsRoutes);

router.use("/customers", customersRoutes);

export default router;
