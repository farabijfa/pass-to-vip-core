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
