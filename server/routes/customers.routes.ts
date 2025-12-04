import { Router } from "express";
import { customersController } from "../controllers/customers.controller";
import { checkApiKey } from "../middleware/auth.middleware";
import { validateProgramIdQuery } from "../middleware/validation.middleware";

const router = Router();

router.get(
  "/",
  checkApiKey,
  validateProgramIdQuery,
  customersController.listCustomers.bind(customersController)
);

router.get(
  "/stats",
  checkApiKey,
  validateProgramIdQuery,
  customersController.getCustomerStats.bind(customersController)
);

router.get(
  "/:customerId",
  checkApiKey,
  customersController.getCustomer.bind(customersController)
);

export default router;
