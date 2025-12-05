import { Router } from "express";
import { enrollController } from "../controllers/enroll.controller";
import { publicEnrollController } from "../controllers/public-enroll.controller";
import rateLimit from "express-rate-limit";

const router = Router();

const enrollRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    success: false,
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message: "Too many enrollment attempts. Please try again later.",
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.get(
  "/:slug",
  enrollController.getBySlug.bind(enrollController)
);

router.get(
  "/program/:slug",
  publicEnrollController.getProgramInfo.bind(publicEnrollController)
);

router.post(
  "/public",
  enrollRateLimiter,
  publicEnrollController.handlePublicEnrollment.bind(publicEnrollController)
);

export default router;
