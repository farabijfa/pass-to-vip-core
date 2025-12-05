import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const membershipTransactionSchema = z.object({
  memberId: z.string().min(1, "Member ID is required"),
  transactionType: z.enum(["earn", "redeem", "adjust", "expire"]),
  points: z.number().int().positive("Points must be a positive integer"),
  description: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  storeId: z.string().optional(),
  passSerialNumber: z.string().optional(),
});

export type MembershipTransaction = z.infer<typeof membershipTransactionSchema>;

export const membershipTransactionResponseSchema = z.object({
  success: z.boolean(),
  transactionId: z.string().optional(),
  newBalance: z.number().optional(),
  previousBalance: z.number().optional(),
  message: z.string().optional(),
  error: z.string().optional(),
});

export type MembershipTransactionResponse = z.infer<typeof membershipTransactionResponseSchema>;

export const oneTimeUseSchema = z.object({
  memberId: z.string().min(1, "Member ID is required"),
  offerId: z.string().min(1, "Offer ID is required"),
  redemptionCode: z.string().optional(),
  storeId: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export type OneTimeUse = z.infer<typeof oneTimeUseSchema>;

export const oneTimeUseResponseSchema = z.object({
  success: z.boolean(),
  redemptionId: z.string().optional(),
  offerDetails: z.object({
    offerId: z.string(),
    offerName: z.string().optional(),
    offerValue: z.number().optional(),
  }).optional(),
  message: z.string().optional(),
  error: z.string().optional(),
});

export type OneTimeUseResponse = z.infer<typeof oneTimeUseResponseSchema>;

export const passKitPassSchema = z.object({
  passTypeIdentifier: z.string(),
  serialNumber: z.string(),
  memberId: z.string(),
  memberName: z.string().optional(),
  tierLevel: z.string().optional(),
  pointsBalance: z.number().optional(),
  barcodeValue: z.string().optional(),
  expirationDate: z.string().optional(),
});

export type PassKitPass = z.infer<typeof passKitPassSchema>;

export const passKitUpdateSchema = z.object({
  serialNumber: z.string().min(1, "Serial number is required"),
  updates: z.object({
    pointsBalance: z.number().optional(),
    tierLevel: z.string().optional(),
    memberName: z.string().optional(),
    expirationDate: z.string().optional(),
  }),
});

export type PassKitUpdate = z.infer<typeof passKitUpdateSchema>;

export const postGridMailSchema = z.object({
  memberId: z.string().min(1, "Member ID is required"),
  templateId: z.string().min(1, "Template ID is required"),
  recipientAddress: z.object({
    name: z.string(),
    addressLine1: z.string(),
    addressLine2: z.string().optional(),
    city: z.string(),
    state: z.string(),
    postalCode: z.string(),
    country: z.string().default("US"),
  }),
  mergeVariables: z.record(z.string()).optional(),
  sendDate: z.string().optional(),
});

export type PostGridMail = z.infer<typeof postGridMailSchema>;

export const postGridMailResponseSchema = z.object({
  success: z.boolean(),
  mailId: z.string().optional(),
  status: z.string().optional(),
  estimatedDeliveryDate: z.string().optional(),
  message: z.string().optional(),
  error: z.string().optional(),
});

export type PostGridMailResponse = z.infer<typeof postGridMailResponseSchema>;

export const postGridPostcardSchema = z.object({
  templateId: z.string().optional(),
  frontTemplateId: z.string().optional(),
  backTemplateId: z.string().optional(),
  size: z.enum(["6x4", "9x6", "11x6"]).default("6x4"),
  recipientAddress: z.object({
    firstName: z.string(),
    lastName: z.string().optional(),
    addressLine1: z.string(),
    addressLine2: z.string().optional(),
    city: z.string(),
    state: z.string(),
    postalCode: z.string(),
    country: z.string().default("US"),
  }),
  senderAddress: z.object({
    companyName: z.string().optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    addressLine1: z.string(),
    addressLine2: z.string().optional(),
    city: z.string(),
    provinceOrState: z.string(),
    postalOrZip: z.string(),
    country: z.string().default("US"),
  }).optional(),
  claimCode: z.string().min(1, "Claim code is required"),
  claimUrl: z.string().url().optional(),
  mergeVariables: z.record(z.string()).optional(),
  sendDate: z.string().optional(),
});

export type PostGridPostcard = z.infer<typeof postGridPostcardSchema>;

export const postGridPostcardResponseSchema = z.object({
  success: z.boolean(),
  postcardId: z.string().optional(),
  status: z.string().optional(),
  estimatedDeliveryDate: z.string().optional(),
  claimCode: z.string().optional(),
  claimUrl: z.string().optional(),
  message: z.string().optional(),
  error: z.string().optional(),
});

export type PostGridPostcardResponse = z.infer<typeof postGridPostcardResponseSchema>;

export const postGridLetterSchema = z.object({
  templateId: z.string().min(1, "Template ID is required"),
  recipientAddress: z.object({
    firstName: z.string(),
    lastName: z.string().optional(),
    addressLine1: z.string(),
    addressLine2: z.string().optional(),
    city: z.string(),
    state: z.string(),
    postalCode: z.string(),
    country: z.string().default("US"),
  }),
  senderAddress: z.object({
    companyName: z.string().optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    addressLine1: z.string(),
    addressLine2: z.string().optional(),
    city: z.string(),
    provinceOrState: z.string(),
    postalOrZip: z.string(),
    country: z.string().default("US"),
  }).optional(),
  claimCode: z.string().min(1, "Claim code is required"),
  claimUrl: z.string().url().optional(),
  mergeVariables: z.record(z.string()).optional(),
  sendDate: z.string().optional(),
  addressPlacement: z.enum(["top_first_page", "insert_blank_page"]).default("top_first_page"),
  doubleSided: z.boolean().default(true),
  color: z.boolean().default(true),
  description: z.string().optional(),
});

export type PostGridLetter = z.infer<typeof postGridLetterSchema>;

export const postGridLetterResponseSchema = z.object({
  success: z.boolean(),
  letterId: z.string().optional(),
  status: z.string().optional(),
  estimatedDeliveryDate: z.string().optional(),
  claimCode: z.string().optional(),
  claimUrl: z.string().optional(),
  message: z.string().optional(),
  error: z.string().optional(),
});

export type PostGridLetterResponse = z.infer<typeof postGridLetterResponseSchema>;

export const batchCampaignContactSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().optional(),
  addressLine1: z.string().min(1, "Address is required"),
  addressLine2: z.string().optional(),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  postalCode: z.string().min(1, "Postal code is required"),
  country: z.string().default("US"),
  email: z.string().email().optional(),
});

export type BatchCampaignContact = z.infer<typeof batchCampaignContactSchema>;

export const batchCampaignRequestSchema = z.object({
  templateId: z.string().optional(),
  frontTemplateId: z.string().optional(),
  backTemplateId: z.string().optional(),
  size: z.enum(["6x4", "9x6", "11x6"]).default("6x4"),
  programId: z.string().min(1, "PassKit Program ID is required"),
  contacts: z.array(batchCampaignContactSchema).min(1, "At least one contact is required"),
  baseClaimUrl: z.string().url().optional(),
  resourceType: z.enum(["postcard", "letter"]).optional(),
  mailingClass: z.enum(["standard", "first_class"]).optional(),
  highCostConfirmation: z.string().optional(),
});

export type BatchCampaignRequest = z.infer<typeof batchCampaignRequestSchema>;

export const claimCodeSchema = z.object({
  claimCode: z.string(),
  status: z.enum(["ISSUED", "INSTALLED", "EXPIRED", "CANCELLED"]),
  passkitProgramId: z.string(),
  passkitInstallUrl: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().optional(),
  createdAt: z.string(),
  installedAt: z.string().optional(),
});

export type ClaimCode = z.infer<typeof claimCodeSchema>;

export const healthCheckSchema = z.object({
  status: z.enum(["healthy", "degraded", "unhealthy"]),
  timestamp: z.string(),
  version: z.string(),
  services: z.object({
    supabase: z.object({
      status: z.enum(["connected", "disconnected", "error"]),
      latency: z.number().optional(),
    }),
    passKit: z.object({
      status: z.enum(["connected", "disconnected", "error"]),
    }),
    postGrid: z.object({
      status: z.enum(["connected", "disconnected", "error"]),
    }),
  }),
});

export type HealthCheck = z.infer<typeof healthCheckSchema>;

export const apiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: z.object({
      code: z.string(),
      message: z.string(),
      details: z.any().optional(),
    }).optional(),
    metadata: z.object({
      requestId: z.string(),
      timestamp: z.string(),
      processingTime: z.number().optional(),
    }).optional(),
  });

export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    requestId: string;
    timestamp: string;
    processingTime?: number;
  };
};

// Campaign Tracking Types
export const postcardSizeSchema = z.enum(["4x6", "6x4", "6x9", "9x6", "6x11", "11x6"]);
export const letterSizeSchema = z.enum(["us_letter", "us_legal", "a4"]);
export const mailingClassSchema = z.enum(["standard_class", "first_class"]);
export const campaignResourceTypeSchema = z.enum(["postcard", "letter"]);
export const campaignStatusSchema = z.enum(["pending", "processing", "completed", "failed", "cancelled"]);
export const contactStatusSchema = z.enum(["pending", "processing", "sent", "delivered", "failed", "cancelled"]);
export const campaignProtocolSchema = z.enum(["MEMBERSHIP", "COUPON", "EVENT_TICKET"]);

export type PostcardSize = z.infer<typeof postcardSizeSchema>;
export type LetterSize = z.infer<typeof letterSizeSchema>;
export type MailingClass = z.infer<typeof mailingClassSchema>;
export type CampaignResourceType = z.infer<typeof campaignResourceTypeSchema>;
export type CampaignStatus = z.infer<typeof campaignStatusSchema>;
export type ContactStatus = z.infer<typeof contactStatusSchema>;
export type CampaignProtocol = z.infer<typeof campaignProtocolSchema>;

export const campaignRunSchema = z.object({
  id: z.string().uuid(),
  programId: z.string(),
  clientId: z.string().optional(),
  resourceType: campaignResourceTypeSchema,
  size: z.union([postcardSizeSchema, letterSizeSchema]).optional(),
  mailingClass: mailingClassSchema.default("standard_class"),
  templateId: z.string().optional(),
  frontTemplateId: z.string().optional(),
  backTemplateId: z.string().optional(),
  protocol: campaignProtocolSchema.optional(),
  passkitCampaignId: z.string().optional(),
  passkitOfferId: z.string().optional(),
  description: z.string().optional(),
  name: z.string().optional(),
  status: campaignStatusSchema.default("pending"),
  totalContacts: z.number().int().default(0),
  successCount: z.number().int().default(0),
  failedCount: z.number().int().default(0),
  estimatedCostCents: z.number().int().optional(),
  actualCostCents: z.number().int().optional(),
  createdBy: z.string(),
  createdAt: z.string(),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
});

export type CampaignRun = z.infer<typeof campaignRunSchema>;

export const campaignContactSchema = z.object({
  id: z.string().uuid(),
  campaignRunId: z.string().uuid(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  addressLine1: z.string(),
  addressLine2: z.string().optional(),
  city: z.string(),
  state: z.string(),
  postalCode: z.string(),
  country: z.string().default("US"),
  status: contactStatusSchema.default("pending"),
  errorMessage: z.string().optional(),
  postgridMailId: z.string().optional(),
  postgridStatus: z.string().optional(),
  estimatedDeliveryDate: z.string().optional(),
  claimCode: z.string().optional(),
  claimUrl: z.string().optional(),
  passkitPassId: z.string().optional(),
  passkitStatus: z.string().optional(),
  createdAt: z.string(),
  processedAt: z.string().optional(),
  deliveredAt: z.string().optional(),
});

export type CampaignContact = z.infer<typeof campaignContactSchema>;

export const createCampaignRequestSchema = z.object({
  programId: z.string().min(1, "Program ID is required"),
  clientId: z.string().optional(),
  resourceType: campaignResourceTypeSchema,
  size: z.string().optional(),
  mailingClass: mailingClassSchema.default("standard_class"),
  templateId: z.string().optional(),
  frontTemplateId: z.string().optional(),
  backTemplateId: z.string().optional(),
  protocol: campaignProtocolSchema.optional(),
  passkitCampaignId: z.string().optional(),
  passkitOfferId: z.string().optional(),
  description: z.string().optional(),
  name: z.string().optional(),
});

export type CreateCampaignRequest = z.infer<typeof createCampaignRequestSchema>;

export const postGridTemplateSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  type: z.enum(["letter", "postcard", "cheque"]).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type PostGridTemplate = z.infer<typeof postGridTemplateSchema>;

export const campaignCostEstimateSchema = z.object({
  contactCount: z.number().int(),
  resourceType: campaignResourceTypeSchema,
  size: z.string().optional(),
  mailingClass: mailingClassSchema,
  unitCostCents: z.number().int(),
  totalCostCents: z.number().int(),
  breakdown: z.object({
    printing: z.number().int(),
    postage: z.number().int(),
    processing: z.number().int(),
  }).optional(),
});

export type CampaignCostEstimate = z.infer<typeof campaignCostEstimateSchema>;
