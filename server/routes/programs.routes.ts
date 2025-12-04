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

export default router;
