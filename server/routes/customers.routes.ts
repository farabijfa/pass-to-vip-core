import { Router } from "express";
import { customersController } from "../controllers/customers.controller";
import { checkApiKey } from "../middleware/auth.middleware";

const router = Router();

router.get(
  "/",
  checkApiKey,
  customersController.listCustomers.bind(customersController)
);

router.get(
  "/stats",
  checkApiKey,
  customersController.getCustomerStats.bind(customersController)
);

router.get(
  "/:customerId",
  checkApiKey,
  customersController.getCustomer.bind(customersController)
);

export default router;
