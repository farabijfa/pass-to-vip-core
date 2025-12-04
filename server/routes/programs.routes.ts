import { Router } from "express";
import { programsController } from "../controllers/programs.controller";
import { checkApiKey } from "../middleware/auth.middleware";
import { validateProgramIdParam } from "../middleware/validation.middleware";

const router = Router();

router.get(
  "/",
  checkApiKey,
  programsController.listPrograms.bind(programsController)
);

router.get(
  "/:programId",
  checkApiKey,
  validateProgramIdParam,
  programsController.getProgram.bind(programsController)
);

router.patch(
  "/:programId",
  checkApiKey,
  validateProgramIdParam,
  programsController.updateProgram.bind(programsController)
);

router.get(
  "/:programId/qr",
  checkApiKey,
  validateProgramIdParam,
  programsController.generateQRCode.bind(programsController)
);

router.get(
  "/:programId/members",
  checkApiKey,
  validateProgramIdParam,
  programsController.getMembers.bind(programsController)
);

router.patch(
  "/:programId/enrollment-url",
  checkApiKey,
  validateProgramIdParam,
  programsController.updateEnrollmentUrl.bind(programsController)
);

router.patch(
  "/:programId/suspend",
  checkApiKey,
  validateProgramIdParam,
  programsController.toggleSuspension.bind(programsController)
);

router.get(
  "/:programId/stats",
  checkApiKey,
  validateProgramIdParam,
  programsController.getStats.bind(programsController)
);

export default router;
