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
