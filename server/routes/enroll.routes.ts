import { Router } from "express";
import { enrollController } from "../controllers/enroll.controller";

const router = Router();

router.get(
  "/:slug",
  enrollController.getBySlug.bind(enrollController)
);

export default router;
