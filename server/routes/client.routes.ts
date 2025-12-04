import { Router } from "express";
import { clientController } from "../controllers/client.controller";

const router = Router();

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

export default router;
