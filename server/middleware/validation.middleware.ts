import type { Request, Response, NextFunction } from "express";
import { body, param, query, validationResult, ValidationChain } from "express-validator";
import { randomUUID } from "crypto";
import type { ApiResponse } from "@shared/schema";

function createErrorResponse(
  code: string,
  message: string,
  details?: any,
  requestId?: string
): ApiResponse<never> {
  return {
    success: false,
    error: {
      code,
      message,
      details,
    },
    metadata: {
      requestId: requestId || randomUUID(),
      timestamp: new Date().toISOString(),
    },
  };
}

export const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const requestId = (req.headers["x-request-id"] as string) || randomUUID();
    const errorDetails = errors.array().map(err => ({
      field: (err as any).path || (err as any).param,
      message: err.msg,
      value: (err as any).value,
    }));

    return res.status(400).json(
      createErrorResponse(
        "VALIDATION_ERROR",
        "Request validation failed",
        errorDetails,
        requestId
      )
    );
  }

  next();
};

export const validateMembershipTransaction = [
  body("memberId")
    .notEmpty()
    .withMessage("Member ID is required")
    .isString()
    .withMessage("Member ID must be a string"),
  body("transactionType")
    .notEmpty()
    .withMessage("Transaction type is required")
    .isIn(["earn", "redeem", "adjust", "expire"])
    .withMessage("Transaction type must be one of: earn, redeem, adjust, expire"),
  body("points")
    .notEmpty()
    .withMessage("Points is required")
    .isInt({ min: 1 })
    .withMessage("Points must be a positive integer"),
  body("description")
    .optional()
    .isString()
    .withMessage("Description must be a string"),
  body("storeId")
    .optional()
    .isString()
    .withMessage("Store ID must be a string"),
  body("passSerialNumber")
    .optional()
    .isString()
    .withMessage("Pass serial number must be a string"),
  body("metadata")
    .optional()
    .isObject()
    .withMessage("Metadata must be an object"),
  handleValidationErrors,
];

export const validateOneTimeUse = [
  body("memberId")
    .notEmpty()
    .withMessage("Member ID is required")
    .isString()
    .withMessage("Member ID must be a string"),
  body("offerId")
    .notEmpty()
    .withMessage("Offer ID is required")
    .isString()
    .withMessage("Offer ID must be a string"),
  body("redemptionCode")
    .optional()
    .isString()
    .withMessage("Redemption code must be a string"),
  body("storeId")
    .optional()
    .isString()
    .withMessage("Store ID must be a string"),
  body("metadata")
    .optional()
    .isObject()
    .withMessage("Metadata must be an object"),
  handleValidationErrors,
];

export const validateMemberId = [
  param("memberId")
    .notEmpty()
    .withMessage("Member ID is required")
    .isString()
    .withMessage("Member ID must be a string"),
  handleValidationErrors,
];

export const validatePaginationQuery = [
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
  query("offset")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Offset must be a non-negative integer"),
  handleValidationErrors,
];

export const validatePassKitPass = [
  body("passTypeIdentifier")
    .notEmpty()
    .withMessage("Pass type identifier is required")
    .isString()
    .withMessage("Pass type identifier must be a string"),
  body("serialNumber")
    .notEmpty()
    .withMessage("Serial number is required")
    .isString()
    .withMessage("Serial number must be a string"),
  body("memberId")
    .notEmpty()
    .withMessage("Member ID is required")
    .isString()
    .withMessage("Member ID must be a string"),
  body("memberName")
    .optional()
    .isString()
    .withMessage("Member name must be a string"),
  body("tierLevel")
    .optional()
    .isString()
    .withMessage("Tier level must be a string"),
  body("pointsBalance")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Points balance must be a non-negative integer"),
  body("barcodeValue")
    .optional()
    .isString()
    .withMessage("Barcode value must be a string"),
  body("expirationDate")
    .optional()
    .isISO8601()
    .withMessage("Expiration date must be a valid ISO 8601 date"),
  handleValidationErrors,
];

export const validatePassKitUpdate = [
  param("serialNumber")
    .notEmpty()
    .withMessage("Serial number is required")
    .isString()
    .withMessage("Serial number must be a string"),
  body("pointsBalance")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Points balance must be a non-negative integer"),
  body("tierLevel")
    .optional()
    .isString()
    .withMessage("Tier level must be a string"),
  body("memberName")
    .optional()
    .isString()
    .withMessage("Member name must be a string"),
  body("expirationDate")
    .optional()
    .isISO8601()
    .withMessage("Expiration date must be a valid ISO 8601 date"),
  handleValidationErrors,
];

export const validateSerialNumber = [
  param("serialNumber")
    .notEmpty()
    .withMessage("Serial number is required")
    .isString()
    .withMessage("Serial number must be a string"),
  handleValidationErrors,
];

export const validatePushNotification = [
  param("serialNumber")
    .notEmpty()
    .withMessage("Serial number is required")
    .isString()
    .withMessage("Serial number must be a string"),
  body("message")
    .notEmpty()
    .withMessage("Message is required")
    .isString()
    .withMessage("Message must be a string")
    .isLength({ max: 256 })
    .withMessage("Message must be 256 characters or less"),
  handleValidationErrors,
];

export const validatePostGridMail = [
  body("memberId")
    .notEmpty()
    .withMessage("Member ID is required")
    .isString()
    .withMessage("Member ID must be a string"),
  body("templateId")
    .notEmpty()
    .withMessage("Template ID is required")
    .isString()
    .withMessage("Template ID must be a string"),
  body("recipientAddress.name")
    .notEmpty()
    .withMessage("Recipient name is required")
    .isString()
    .withMessage("Recipient name must be a string"),
  body("recipientAddress.addressLine1")
    .notEmpty()
    .withMessage("Address line 1 is required")
    .isString()
    .withMessage("Address line 1 must be a string"),
  body("recipientAddress.addressLine2")
    .optional()
    .isString()
    .withMessage("Address line 2 must be a string"),
  body("recipientAddress.city")
    .notEmpty()
    .withMessage("City is required")
    .isString()
    .withMessage("City must be a string"),
  body("recipientAddress.state")
    .notEmpty()
    .withMessage("State is required")
    .isString()
    .withMessage("State must be a string"),
  body("recipientAddress.postalCode")
    .notEmpty()
    .withMessage("Postal code is required")
    .isString()
    .withMessage("Postal code must be a string"),
  body("recipientAddress.country")
    .optional()
    .isString()
    .withMessage("Country must be a string"),
  body("mergeVariables")
    .optional()
    .isObject()
    .withMessage("Merge variables must be an object"),
  body("sendDate")
    .optional()
    .isISO8601()
    .withMessage("Send date must be a valid ISO 8601 date"),
  handleValidationErrors,
];

export const validateMailId = [
  param("mailId")
    .notEmpty()
    .withMessage("Mail ID is required")
    .isString()
    .withMessage("Mail ID must be a string"),
  handleValidationErrors,
];
