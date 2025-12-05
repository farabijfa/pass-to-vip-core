import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import path from "path";
import { campaignController } from "../controllers/campaign.controller";
import { jwtAuth } from "../middleware/auth.middleware";

const router = Router();

const VALID_POSTCARD_SIZES = ["6x4", "9x6", "11x6"] as const;
type PostcardSize = typeof VALID_POSTCARD_SIZES[number];

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.join(process.cwd(), "server/uploads"));
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `campaign-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const fileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  if (
    file.mimetype === "text/csv" ||
    file.originalname.toLowerCase().endsWith(".csv")
  ) {
    cb(null, true);
  } else {
    cb(new Error("Only CSV files are allowed"));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

const validateCampaignOptions = (req: Request, res: Response, next: NextFunction) => {
  const { resource_type, size } = req.body;

  const resourceType = resource_type || "postcard";
  
  if (resourceType !== "postcard" && resourceType !== "letter") {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_RESOURCE_TYPE",
        message: "resource_type must be either 'postcard' or 'letter'",
      },
    });
  }

  if (resourceType === "postcard") {
    const postcardSize = size || "6x4";
    
    if (!VALID_POSTCARD_SIZES.includes(postcardSize as PostcardSize)) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_POSTCARD_SIZE",
          message: `size must be one of: ${VALID_POSTCARD_SIZES.join(", ")}`,
        },
      });
    }

    req.body.size = postcardSize;
  }

  req.body.resource_type = resourceType;

  next();
};

router.post(
  "/preview-csv",
  jwtAuth,
  upload.single("file"),
  campaignController.previewCsv.bind(campaignController)
);

router.post(
  "/upload-csv",
  jwtAuth,
  upload.single("file"),
  validateCampaignOptions,
  campaignController.uploadCsv.bind(campaignController)
);

export default router;
