import { Router } from "express";
import { adminController } from "../controllers/admin.controller";
import { checkApiKey } from "../middleware/auth.middleware";

const router = Router();

router.post(
  "/provision",
  checkApiKey,
  adminController.provisionTenant.bind(adminController)
);

router.get(
  "/tenants",
  checkApiKey,
  adminController.listTenants.bind(adminController)
);

router.get(
  "/tenants/:userId",
  checkApiKey,
  adminController.getTenant.bind(adminController)
);

router.get(
  "/tenants/:userId/full-profile",
  checkApiKey,
  adminController.getTenantProfile.bind(adminController)
);

router.patch(
  "/tenants/:programId/config",
  checkApiKey,
  adminController.updateTenantConfig.bind(adminController)
);

router.delete(
  "/tenants/:userId",
  checkApiKey,
  adminController.deleteTenant.bind(adminController)
);

router.post(
  "/tenants/:programId/retry-passkit",
  checkApiKey,
  adminController.retryPassKitProvisioning.bind(adminController)
);

router.patch(
  "/tenants/:programId/passkit",
  checkApiKey,
  adminController.updatePassKitSettings.bind(adminController)
);

router.get(
  "/passkit/status",
  checkApiKey,
  adminController.getPassKitHealth.bind(adminController)
);

// Multi-Program Management Routes
router.get(
  "/tenants/:userId/programs",
  checkApiKey,
  adminController.listTenantPrograms.bind(adminController)
);

router.post(
  "/tenants/:userId/programs",
  checkApiKey,
  adminController.addProgramToTenant.bind(adminController)
);

router.delete(
  "/tenants/:userId/programs/:programId",
  checkApiKey,
  adminController.removeProgram.bind(adminController)
);

router.patch(
  "/tenants/:userId/programs/:programId/primary",
  checkApiKey,
  adminController.setPrimaryProgram.bind(adminController)
);

export default router;
