import { Router, Request, Response } from "express";
import { enrollController } from "../controllers/enroll.controller";

const router = Router();

router.get(
  "/:slug",
  enrollController.getBySlug.bind(enrollController)
);

router.post(
  "/public",
  (_req: Request, res: Response) => {
    res.status(410).json({
      success: false,
      error: {
        code: "ENDPOINT_DEPRECATED",
        message: "This enrollment method has been deprecated. Please use the PassKit enrollment form directly via the program's enrollment URL.",
      },
      metadata: {
        deprecatedAt: "2025-12-05",
        alternativeMethod: "Use GET /api/enroll/:slug to retrieve the program's enrollment_url, then redirect users to that PassKit-hosted form.",
      },
    });
  }
);

export default router;
