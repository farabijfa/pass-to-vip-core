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

router.delete(
  "/tenants/:userId",
  checkApiKey,
  adminController.deleteTenant.bind(adminController)
);

export default router;
