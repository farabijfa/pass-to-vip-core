import { Router } from "express";
import loyaltyRoutes from "./loyalty.routes";
import passKitRoutes from "./passkit.routes";
import postGridRoutes from "./postgrid.routes";
import healthRoutes from "./health.routes";
import posRoutes from "./pos.routes";
import campaignRoutes from "./campaign.routes";

const router = Router();

router.use("/pos", posRoutes);

router.use("/loyalty", loyaltyRoutes);

router.use("/wallet", passKitRoutes);

router.use("/mail", postGridRoutes);

router.use("/health", healthRoutes);

router.use("/campaign", campaignRoutes);

export default router;
