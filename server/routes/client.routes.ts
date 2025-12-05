import { Router } from "express";
import { clientController } from "../controllers/client.controller";

const router = Router();

router.post(
  "/login",
  clientController.login.bind(clientController)
);

router.get(
  "/me",
  clientController.getMe.bind(clientController)
);

router.get(
  "/analytics",
  clientController.getAnalytics.bind(clientController)
);

router.get(
  "/members",
  clientController.getMembers.bind(clientController)
);

router.get(
  "/members/search",
  clientController.getMembers.bind(clientController)
);

router.get(
  "/campaigns",
  clientController.getCampaigns.bind(clientController)
);

router.get(
  "/admin/tenants",
  clientController.getTenantsAsAdmin.bind(clientController)
);

router.post(
  "/admin/provision",
  clientController.provisionTenantAsAdmin.bind(clientController)
);

router.delete(
  "/admin/tenants/:userId",
  clientController.deleteTenantAsAdmin.bind(clientController)
);

router.get(
  "/admin/tenants/:userId/full-profile",
  clientController.getTenantProfileAsAdmin.bind(clientController)
);

router.patch(
  "/admin/tenants/:programId/config",
  clientController.updateTenantConfigAsAdmin.bind(clientController)
);

router.post(
  "/admin/tenants/:programId/retry-passkit",
  clientController.retryPassKitSyncAsAdmin.bind(clientController)
);

// Multi-Program Management Routes (Admin)
router.get(
  "/admin/tenants/:userId/programs",
  clientController.listTenantProgramsAsAdmin.bind(clientController)
);

router.post(
  "/admin/tenants/:userId/programs",
  clientController.addProgramToTenantAsAdmin.bind(clientController)
);

router.delete(
  "/admin/tenants/:userId/programs/:programId",
  clientController.removeProgramAsAdmin.bind(clientController)
);

router.patch(
  "/admin/tenants/:userId/programs/:programId/primary",
  clientController.setPrimaryProgramAsAdmin.bind(clientController)
);

// Tier Threshold Management (MEMBERSHIP programs only)
router.patch(
  "/admin/programs/:programId/tier-thresholds",
  clientController.updateProgramTierThresholdsAsAdmin.bind(clientController)
);

export default router;
