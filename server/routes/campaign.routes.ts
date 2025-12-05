import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import path from "path";
import { campaignController } from "../controllers/campaign.controller";
import { jwtAuth } from "../middleware/auth.middleware";

const router = Router();

const requireAdminRole = (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user;
  
  if (!user) {
    return res.status(401).json({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Authentication required" },
    });
  }

  const allowedRoles = ["SUPER_ADMIN", "PLATFORM_ADMIN"];
  if (!allowedRoles.includes(user.role)) {
    return res.status(403).json({
      success: false,
      error: { 
        code: "FORBIDDEN", 
        message: "Access denied. Campaign management requires SUPER_ADMIN or PLATFORM_ADMIN role." 
      },
    });
  }

  next();
};

const VALID_POSTCARD_SIZES = ["4x6", "6x4", "6x9", "9x6", "6x11", "11x6"] as const;
const VALID_LETTER_SIZES = ["us_letter", "us_legal", "a4"] as const;
const VALID_MAILING_CLASSES = ["standard_class", "first_class"] as const;
type PostcardSize = typeof VALID_POSTCARD_SIZES[number];
type LetterSize = typeof VALID_LETTER_SIZES[number];
type MailingClass = typeof VALID_MAILING_CLASSES[number];

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
  const { resource_type, size, mailing_class } = req.body;

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

  if (resourceType === "letter") {
    const letterSize = size || "us_letter";
    
    if (!VALID_LETTER_SIZES.includes(letterSize as LetterSize)) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_LETTER_SIZE",
          message: `letter size must be one of: ${VALID_LETTER_SIZES.join(", ")}`,
        },
      });
    }

    req.body.size = letterSize;
  }

  if (mailing_class) {
    if (!VALID_MAILING_CLASSES.includes(mailing_class as MailingClass)) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_MAILING_CLASS",
          message: `mailing_class must be one of: ${VALID_MAILING_CLASSES.join(", ")}`,
        },
      });
    }
    req.body.mailing_class = mailing_class;
  } else {
    req.body.mailing_class = "standard_class";
  }

  req.body.resource_type = resourceType;

  next();
};

router.post(
  "/preview-csv",
  jwtAuth,
  requireAdminRole,
  upload.single("file"),
  campaignController.previewCsv.bind(campaignController)
);

router.post(
  "/upload-csv",
  jwtAuth,
  requireAdminRole,
  upload.single("file"),
  validateCampaignOptions,
  campaignController.uploadCsv.bind(campaignController)
);

router.get(
  "/templates",
  jwtAuth,
  requireAdminRole,
  campaignController.getTemplates.bind(campaignController)
);

router.post(
  "/validate-client",
  jwtAuth,
  requireAdminRole,
  campaignController.validateClient.bind(campaignController)
);

router.post(
  "/estimate-cost",
  jwtAuth,
  requireAdminRole,
  validateCampaignOptions,
  campaignController.estimateCost.bind(campaignController)
);

router.get(
  "/history",
  jwtAuth,
  requireAdminRole,
  campaignController.getCampaignHistory.bind(campaignController)
);

router.get(
  "/:campaignId",
  jwtAuth,
  requireAdminRole,
  campaignController.getCampaignDetails.bind(campaignController)
);

router.get(
  "/config/options",
  jwtAuth,
  requireAdminRole,
  (_req: Request, res: Response) => {
    res.json({
      success: true,
      data: {
        postcardSizes: VALID_POSTCARD_SIZES,
        letterSizes: VALID_LETTER_SIZES,
        mailingClasses: VALID_MAILING_CLASSES,
        resourceTypes: ["postcard", "letter"],
      },
    });
  }
);

export default router;
