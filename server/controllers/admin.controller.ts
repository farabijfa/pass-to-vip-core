import type { Request, Response } from "express";
import { adminService } from "../services/admin.service";
import { passKitService } from "../services/passkit.service";
import { postGridService } from "../services/postgrid.service";
import { supabaseService } from "../services/supabase.service";
import { getAppUrl } from "../config";
import { z } from "zod";
import { passKitSyncService } from "../services/passkit-sync.service";

const provisionTenantSchema = z.object({
  businessName: z.string().min(1, "Business name is required"),
  email: z.string().email("Valid email is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  passkitProgramId: z.string().optional(),
  passkitTierId: z.string().optional(),
  protocol: z.enum(["MEMBERSHIP", "COUPON", "EVENT_TICKET"]).default("MEMBERSHIP"),
  timezone: z.string().default("America/New_York"),
  autoProvision: z.boolean().default(false),
  earnRateMultiplier: z.number().int().min(1).max(1000).default(10),
});

class AdminController {
  async provisionTenant(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();

    try {
      const validation = provisionTenantSchema.safeParse(req.body);

      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request body",
            details: validation.error.errors,
          },
        });
        return;
      }

      const { 
        businessName, 
        email, 
        password, 
        passkitProgramId, 
        passkitTierId,
        protocol, 
        timezone,
        autoProvision,
        earnRateMultiplier,
      } = validation.data;

      const result = await adminService.createTenant({
        businessName,
        email,
        password,
        passkitProgramId,
        passkitTierId,
        protocol,
        timezone,
        autoProvision,
        earnRateMultiplier,
      });

      const processingTime = Date.now() - startTime;

      if (!result.success) {
        const statusCode = result.error?.includes("already") ? 409 : 500;
        let errorCode = "PROVISIONING_FAILED";
        
        if (statusCode === 409) {
          if (result.error?.includes("name")) {
            errorCode = "DUPLICATE_BUSINESS_NAME";
          } else if (result.error?.includes("PassKit")) {
            errorCode = "DUPLICATE_PASSKIT_ID";
          } else if (result.error?.includes("email")) {
            errorCode = "DUPLICATE_EMAIL";
          } else {
            errorCode = "DUPLICATE_ENTRY";
          }
        }
        
        res.status(statusCode).json({
          success: false,
          error: {
            code: errorCode,
            message: result.error,
          },
          metadata: {
            processingTime,
          },
        });
        return;
      }

      res.status(201).json({
        success: true,
        data: {
          userId: result.userId,
          programId: result.programId,
          email: result.email,
          businessName: result.businessName,
          dashboardSlug: result.dashboardSlug,
          dashboardUrl: result.dashboardUrl,
          passkit: {
            status: result.passkitStatus,
            programId: result.passkitProgramId,
            tierId: result.passkitTierId,
            enrollmentUrl: result.enrollmentUrl,
          },
          pointSystem: {
            earnRateMultiplier: result.earnRateMultiplier,
            description: `$1.00 spent = ${result.earnRateMultiplier} points`,
          },
        },
        metadata: {
          processingTime,
        },
      });

    } catch (error) {
      console.error("Provision tenant error:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Unknown error occurred",
        },
      });
    }
  }

  async getTenant(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;

      if (!userId) {
        res.status(400).json({
          success: false,
          error: {
            code: "MISSING_USER_ID",
            message: "User ID is required",
          },
        });
        return;
      }

      const result = await adminService.getTenant(userId);

      if (!result.success) {
        res.status(404).json({
          success: false,
          error: {
            code: "TENANT_NOT_FOUND",
            message: result.error || "Tenant not found",
          },
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result.tenant,
      });

    } catch (error) {
      console.error("Get tenant error:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Unknown error occurred",
        },
      });
    }
  }

  async listTenants(_req: Request, res: Response): Promise<void> {
    try {
      const result = await adminService.listTenants();

      if (!result.success) {
        res.status(500).json({
          success: false,
          error: {
            code: "LIST_FAILED",
            message: result.error,
          },
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          tenants: result.tenants,
          count: result.tenants?.length || 0,
        },
      });

    } catch (error) {
      console.error("List tenants error:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Unknown error occurred",
        },
      });
    }
  }

  async deleteTenant(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;

      if (!userId) {
        res.status(400).json({
          success: false,
          error: {
            code: "MISSING_USER_ID",
            message: "User ID is required",
          },
        });
        return;
      }

      const result = await adminService.deleteTenant(userId);

      if (!result.success) {
        res.status(500).json({
          success: false,
          error: {
            code: "DELETE_FAILED",
            message: result.error,
          },
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Tenant deleted successfully",
      });

    } catch (error) {
      console.error("Delete tenant error:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Unknown error occurred",
        },
      });
    }
  }

  async retryPassKitProvisioning(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();

    try {
      const { programId } = req.params;

      if (!programId) {
        res.status(400).json({
          success: false,
          error: {
            code: "MISSING_PROGRAM_ID",
            message: "Program ID is required",
          },
        });
        return;
      }

      const result = await adminService.retryPassKitProvisioning(programId);
      const processingTime = Date.now() - startTime;

      if (!result.success) {
        const isNotFound = result.error?.includes("not found");
        const isValidationError = result.error?.includes("already has") || 
                                   result.error?.includes("Cannot retry") ||
                                   result.error?.includes("only supports");
        const statusCode = isNotFound ? 404 : isValidationError ? 400 : 500;
        
        res.status(statusCode).json({
          success: false,
          error: {
            code: isNotFound ? "NOT_FOUND" : isValidationError ? "VALIDATION_ERROR" : "PROVISIONING_FAILED",
            message: result.error,
          },
          data: {
            programId: result.programId,
            passkitStatus: result.passkitStatus,
          },
          metadata: { processingTime },
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          programId: result.programId,
          passkit: {
            status: result.passkitStatus,
            programId: result.passkitProgramId,
            tierId: result.passkitTierId,
            enrollmentUrl: result.enrollmentUrl,
          },
        },
        metadata: { processingTime },
      });

    } catch (error) {
      console.error("Retry PassKit provisioning error:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Unknown error occurred",
        },
      });
    }
  }

  async updatePassKitSettings(req: Request, res: Response): Promise<void> {
    try {
      const { programId } = req.params;
      const { passkitProgramId, passkitTierId, enrollmentUrl } = req.body;

      if (!programId) {
        res.status(400).json({
          success: false,
          error: {
            code: "MISSING_PROGRAM_ID",
            message: "Program ID is required",
          },
        });
        return;
      }

      if (!passkitProgramId && !passkitTierId && !enrollmentUrl) {
        res.status(400).json({
          success: false,
          error: {
            code: "NO_UPDATES",
            message: "At least one of passkitProgramId, passkitTierId, or enrollmentUrl is required",
          },
        });
        return;
      }

      const result = await adminService.updatePassKitSettings(programId, {
        passkitProgramId,
        passkitTierId,
        enrollmentUrl,
      });

      if (!result.success) {
        const isNotFound = result.error?.includes("not found");
        const isDuplicate = result.error?.includes("already used");
        const isValidationError = result.error?.includes("No valid fields");
        const statusCode = isNotFound ? 404 : isDuplicate ? 409 : isValidationError ? 400 : 500;
        const errorCode = isNotFound ? "NOT_FOUND" : isDuplicate ? "DUPLICATE_PASSKIT_ID" : isValidationError ? "VALIDATION_ERROR" : "UPDATE_FAILED";
        
        res.status(statusCode).json({
          success: false,
          error: {
            code: errorCode,
            message: result.error,
          },
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "PassKit settings updated successfully",
      });

    } catch (error) {
      console.error("Update PassKit settings error:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Unknown error occurred",
        },
      });
    }
  }

  async getPassKitHealth(_req: Request, res: Response): Promise<void> {
    try {
      const result = await adminService.getPassKitHealth();

      res.status(200).json({
        success: true,
        data: {
          passkit: {
            configured: result.configured,
            status: result.status,
          },
        },
      });

    } catch (error) {
      console.error("PassKit health check error:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Unknown error occurred",
        },
      });
    }
  }

  async getTenantProfile(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;

      if (!userId) {
        res.status(400).json({
          success: false,
          error: {
            code: "MISSING_USER_ID",
            message: "User ID is required",
          },
        });
        return;
      }

      const result = await adminService.getTenantFullProfile(userId);

      if (!result.success) {
        const isNotFound = result.error?.includes("not found");
        res.status(isNotFound ? 404 : 500).json({
          success: false,
          error: {
            code: isNotFound ? "NOT_FOUND" : "FETCH_FAILED",
            message: result.error || "Failed to fetch profile",
          },
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result.profile,
      });

    } catch (error) {
      console.error("Get tenant profile error:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Unknown error occurred",
        },
      });
    }
  }

  async updateTenantConfig(req: Request, res: Response): Promise<void> {
    try {
      const { programId } = req.params;

      if (!programId) {
        res.status(400).json({
          success: false,
          error: {
            code: "MISSING_PROGRAM_ID",
            message: "Program ID is required",
          },
        });
        return;
      }

      const updateConfigSchema = z.object({
        earnRateMultiplier: z.number().int().min(1).max(1000).optional(),
        memberLimit: z.number().int().min(0).nullable().optional(),
        postgridTemplateId: z.string().nullable().optional(),
        isSuspended: z.boolean().optional(),
      });

      const validation = updateConfigSchema.safeParse(req.body);

      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request body",
            details: validation.error.errors,
          },
        });
        return;
      }

      const result = await adminService.updateTenantConfig(programId, validation.data);

      if (!result.success) {
        const isNotFound = result.error?.includes("not found");
        res.status(isNotFound ? 404 : 400).json({
          success: false,
          error: {
            code: isNotFound ? "NOT_FOUND" : "UPDATE_FAILED",
            message: result.error || "Failed to update configuration",
          },
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result.program,
        message: "Configuration updated successfully",
      });

    } catch (error) {
      console.error("Update tenant config error:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Unknown error occurred",
        },
      });
    }
  }

  // ============================================================
  // MULTI-PROGRAM MANAGEMENT ENDPOINTS
  // ============================================================

  async listTenantPrograms(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;

      if (!userId) {
        res.status(400).json({
          success: false,
          error: {
            code: "MISSING_USER_ID",
            message: "User ID is required",
          },
        });
        return;
      }

      const result = await adminService.listTenantPrograms(userId);

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: {
            code: "LIST_PROGRAMS_FAILED",
            message: result.error || "Failed to list programs",
          },
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          programs: result.programs,
          count: result.programs?.length || 0,
        },
      });

    } catch (error) {
      console.error("List tenant programs error:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Unknown error occurred",
        },
      });
    }
  }

  async addProgramToTenant(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();

    try {
      const { userId } = req.params;

      if (!userId) {
        res.status(400).json({
          success: false,
          error: {
            code: "MISSING_USER_ID",
            message: "User ID is required",
          },
        });
        return;
      }

      const addProgramSchema = z.object({
        name: z.string().min(1, "Program name is required"),
        protocol: z.enum(["MEMBERSHIP", "COUPON", "EVENT_TICKET"]),
        passkitProgramId: z.string().optional(),
        passkitTierId: z.string().optional(),
        timezone: z.string().default("America/New_York"),
        autoProvision: z.boolean().default(true),
        earnRateMultiplier: z.number().int().min(1).max(1000).default(10),
      });

      const validation = addProgramSchema.safeParse(req.body);

      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request body",
            details: validation.error.errors,
          },
        });
        return;
      }

      const result = await adminService.addProgramToTenant({
        tenantId: userId,
        ...validation.data,
      });

      const processingTime = Date.now() - startTime;

      if (!result.success) {
        const isDuplicate = result.error?.includes("already has");
        res.status(isDuplicate ? 409 : 400).json({
          success: false,
          error: {
            code: isDuplicate ? "DUPLICATE_PROTOCOL" : "ADD_PROGRAM_FAILED",
            message: result.error || "Failed to add program",
          },
          metadata: { processingTime },
        });
        return;
      }

      res.status(201).json({
        success: true,
        data: {
          programId: result.programId,
          dashboardSlug: result.dashboardSlug,
          passkit: {
            status: result.passkitStatus,
            programId: result.passkitProgramId,
            tierId: result.passkitTierId,
            enrollmentUrl: result.enrollmentUrl,
          },
        },
        message: `${validation.data.protocol} program added successfully`,
        metadata: { processingTime },
      });

    } catch (error) {
      console.error("Add program to tenant error:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Unknown error occurred",
        },
      });
    }
  }

  async removeProgram(req: Request, res: Response): Promise<void> {
    try {
      const { userId, programId } = req.params;

      if (!userId || !programId) {
        res.status(400).json({
          success: false,
          error: {
            code: "MISSING_PARAMS",
            message: "User ID and Program ID are required",
          },
        });
        return;
      }

      const result = await adminService.removeProgram(userId, programId);

      if (!result.success) {
        const isNotFound = result.error?.includes("not found");
        const isForbidden = result.error?.includes("Cannot delete");
        res.status(isNotFound ? 404 : isForbidden ? 403 : 400).json({
          success: false,
          error: {
            code: isNotFound ? "NOT_FOUND" : isForbidden ? "FORBIDDEN" : "REMOVE_FAILED",
            message: result.error || "Failed to remove program",
          },
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Program removed successfully",
      });

    } catch (error) {
      console.error("Remove program error:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Unknown error occurred",
        },
      });
    }
  }

  async setPrimaryProgram(req: Request, res: Response): Promise<void> {
    try {
      const { userId, programId } = req.params;

      if (!userId || !programId) {
        res.status(400).json({
          success: false,
          error: {
            code: "MISSING_PARAMS",
            message: "User ID and Program ID are required",
          },
        });
        return;
      }

      const result = await adminService.setPrimaryProgram(userId, programId);

      if (!result.success) {
        const isNotFound = result.error?.includes("not found");
        res.status(isNotFound ? 404 : 400).json({
          success: false,
          error: {
            code: isNotFound ? "NOT_FOUND" : "SET_PRIMARY_FAILED",
            message: result.error || "Failed to set primary program",
          },
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Primary program updated successfully",
      });

    } catch (error) {
      console.error("Set primary program error:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Unknown error occurred",
        },
      });
    }
  }

  async createPosApiKey(req: Request, res: Response): Promise<void> {
    try {
      const { programId } = req.params;
      const { label } = req.body;

      if (!programId) {
        res.status(400).json({
          success: false,
          error: {
            code: "MISSING_PARAMS",
            message: "Program ID is required",
          },
        });
        return;
      }

      const result = await adminService.createPosApiKey(programId, label);

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: {
            code: "CREATE_KEY_FAILED",
            message: result.error || "Failed to create API key",
          },
        });
        return;
      }

      res.status(201).json({
        success: true,
        data: {
          keyId: result.keyId,
          apiKey: result.apiKey,
          label: result.label,
          message: "Store this API key securely. It will not be shown again.",
        },
      });

    } catch (error) {
      console.error("Create POS API key error:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Unknown error occurred",
        },
      });
    }
  }

  async listPosApiKeys(req: Request, res: Response): Promise<void> {
    try {
      const { programId } = req.params;

      if (!programId) {
        res.status(400).json({
          success: false,
          error: {
            code: "MISSING_PARAMS",
            message: "Program ID is required",
          },
        });
        return;
      }

      const result = await adminService.listPosApiKeys(programId);

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: {
            code: "LIST_KEYS_FAILED",
            message: result.error || "Failed to list API keys",
          },
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          keys: result.keys,
        },
      });

    } catch (error) {
      console.error("List POS API keys error:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Unknown error occurred",
        },
      });
    }
  }

  async revokePosApiKey(req: Request, res: Response): Promise<void> {
    try {
      const { programId, keyId } = req.params;

      if (!programId || !keyId) {
        res.status(400).json({
          success: false,
          error: {
            code: "MISSING_PARAMS",
            message: "Program ID and Key ID are required",
          },
        });
        return;
      }

      const result = await adminService.revokePosApiKey(programId, keyId);

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: {
            code: "REVOKE_KEY_FAILED",
            message: result.error || "Failed to revoke API key",
          },
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "API key revoked successfully",
      });

    } catch (error) {
      console.error("Revoke POS API key error:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Unknown error occurred",
        },
      });
    }
  }

  async updateSpendTierConfig(req: Request, res: Response): Promise<void> {
    const spendTierConfigSchema = z.object({
      spendTier2ThresholdCents: z.number().int().positive().optional(),
      spendTier3ThresholdCents: z.number().int().positive().optional(),
      spendTier4ThresholdCents: z.number().int().positive().optional(),
      tier1DiscountPercent: z.number().min(0).max(100).optional(),
      tier2DiscountPercent: z.number().min(0).max(100).optional(),
      tier3DiscountPercent: z.number().min(0).max(100).optional(),
      tier4DiscountPercent: z.number().min(0).max(100).optional(),
    });

    try {
      const { programId } = req.params;

      if (!programId) {
        res.status(400).json({
          success: false,
          error: {
            code: "MISSING_PARAMS",
            message: "Program ID is required",
          },
        });
        return;
      }

      const validation = spendTierConfigSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid tier configuration",
            details: validation.error.errors,
          },
        });
        return;
      }

      const result = await adminService.updateSpendTierConfig(programId, validation.data);

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: {
            code: "UPDATE_CONFIG_FAILED",
            message: result.error || "Failed to update tier configuration",
          },
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Spend tier configuration updated successfully",
        data: result.config,
      });

    } catch (error) {
      console.error("Update spend tier config error:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Unknown error occurred",
        },
      });
    }
  }

  async getSpendTierConfig(req: Request, res: Response): Promise<void> {
    try {
      const { programId } = req.params;

      if (!programId) {
        res.status(400).json({
          success: false,
          error: {
            code: "MISSING_PARAMS",
            message: "Program ID is required",
          },
        });
        return;
      }

      const result = await adminService.getSpendTierConfig(programId);

      if (!result.success) {
        res.status(404).json({
          success: false,
          error: {
            code: "NOT_FOUND",
            message: result.error || "Program not found",
          },
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result.config,
      });

    } catch (error) {
      console.error("Get spend tier config error:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Unknown error occurred",
        },
      });
    }
  }

  async listPassKitPrograms(req: Request, res: Response): Promise<void> {
    try {
      const statusFilter = req.query.status as 'PROJECT_PUBLISHED' | 'PROJECT_ACTIVE_FOR_OBJECT_CREATION' | 'PROJECT_DRAFT' | 'all' | undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

      const result = await passKitService.listPrograms({
        statusFilter: statusFilter || 'all',
        limit,
        offset,
      });

      if (!result.success) {
        res.status(500).json({
          success: false,
          error: {
            code: "PASSKIT_API_ERROR",
            message: result.error || "Failed to list PassKit programs",
          },
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          programs: result.programs,
          total: result.total,
        },
        metadata: {
          filter: statusFilter || 'all',
          limit,
          offset,
        },
      });

    } catch (error) {
      console.error("List PassKit programs error:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Unknown error occurred",
        },
      });
    }
  }

  async getPassKitProgram(req: Request, res: Response): Promise<void> {
    try {
      const { passkitProgramId } = req.params;

      if (!passkitProgramId) {
        res.status(400).json({
          success: false,
          error: {
            code: "MISSING_PARAMS",
            message: "PassKit Program ID is required",
          },
        });
        return;
      }

      const result = await passKitService.getProgram(passkitProgramId);

      if (!result.success) {
        const statusCode = result.error?.includes("not found") ? 404 : 500;
        res.status(statusCode).json({
          success: false,
          error: {
            code: statusCode === 404 ? "NOT_FOUND" : "PASSKIT_API_ERROR",
            message: result.error || "Failed to get PassKit program",
          },
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result.program,
      });

    } catch (error) {
      console.error("Get PassKit program error:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Unknown error occurred",
        },
      });
    }
  }

  async listPassKitTiers(req: Request, res: Response): Promise<void> {
    try {
      const { passkitProgramId } = req.params;

      if (!passkitProgramId) {
        res.status(400).json({
          success: false,
          error: {
            code: "MISSING_PARAMS",
            message: "PassKit Program ID is required",
          },
        });
        return;
      }

      const result = await passKitService.listTiers(passkitProgramId);

      if (!result.success) {
        res.status(500).json({
          success: false,
          error: {
            code: "PASSKIT_API_ERROR",
            message: result.error || "Failed to list PassKit tiers",
          },
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          tiers: result.tiers,
          programId: passkitProgramId,
        },
      });

    } catch (error) {
      console.error("List PassKit tiers error:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Unknown error occurred",
        },
      });
    }
  }

  async verifyPassKitProgram(req: Request, res: Response): Promise<void> {
    try {
      const { passkitProgramId } = req.params;

      if (!passkitProgramId) {
        res.status(400).json({
          success: false,
          error: {
            code: "MISSING_PARAMS",
            message: "PassKit Program ID is required",
          },
        });
        return;
      }

      const result = await passKitService.verifyProgramIsLive(passkitProgramId);

      if (!result.success) {
        const statusCode = result.error?.includes("not found") ? 404 : 500;
        res.status(statusCode).json({
          success: false,
          error: {
            code: statusCode === 404 ? "NOT_FOUND" : "PASSKIT_API_ERROR",
            message: result.error || "Failed to verify PassKit program",
          },
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          programId: passkitProgramId,
          isLive: result.isLive,
          status: result.status,
          recommendation: result.isLive 
            ? "This program is live and ready for production use." 
            : "WARNING: This program is in DRAFT mode. Passes will expire after 48 hours. Go live in PassKit dashboard before using in production.",
        },
      });

    } catch (error) {
      console.error("Verify PassKit program error:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Unknown error occurred",
        },
      });
    }
  }

  async testSendLetter(req: Request, res: Response): Promise<void> {
    try {
      const testLetterSchema = z.object({
        passkitProgramId: z.string().min(1, "PassKit Program ID is required"),
        templateId: z.string().default("template_3J62GbmowSk7SeD4dFcaUs"),
        recipient: z.object({
          firstName: z.string().min(1, "First name is required"),
          lastName: z.string().optional(),
          email: z.string().email().optional(),
          addressLine1: z.string().min(1, "Address is required"),
          city: z.string().min(1, "City is required"),
          state: z.string().min(2).max(2, "State must be 2-letter code"),
          postalCode: z.string().min(5, "Postal code is required"),
        }),
        description: z.string().optional(),
      });

      const validation = testLetterSchema.safeParse(req.body);

      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request body",
            details: validation.error.errors,
          },
        });
        return;
      }

      const { passkitProgramId, templateId, recipient, description } = validation.data;
      const baseClaimUrl = `${getAppUrl()}/claim`;

      console.log(`📧 Starting test letter flow for PassKit program: ${passkitProgramId}`);

      const claimResult = await supabaseService.generateClaimCode({
        passkitProgramId,
        contact: {
          firstName: recipient.firstName,
          lastName: recipient.lastName,
          email: recipient.email,
          addressLine1: recipient.addressLine1,
          city: recipient.city,
          state: recipient.state,
          postalCode: recipient.postalCode,
          country: "US",
        },
      });

      if (!claimResult.success || !claimResult.claimCode) {
        console.error("Failed to generate claim code:", claimResult.error);
        res.status(500).json({
          success: false,
          error: {
            code: "CLAIM_GENERATION_FAILED",
            message: claimResult.error || "Failed to generate claim code",
          },
        });
        return;
      }

      const claimCode = claimResult.claimCode;
      const claimUrl = `${baseClaimUrl}/${claimCode}`;
      const qrCodeImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=450x450&qzone=1&data=${encodeURIComponent(claimUrl)}`;

      console.log(`🎟️ Generated claim code: ${claimCode}`);
      console.log(`🔗 Claim URL: ${claimUrl}`);

      const letterResult = await postGridService.sendLetter({
        templateId,
        recipientAddress: {
          firstName: recipient.firstName,
          lastName: recipient.lastName,
          addressLine1: recipient.addressLine1,
          city: recipient.city,
          state: recipient.state,
          postalCode: recipient.postalCode,
          country: "US",
        },
        claimCode,
        claimUrl,
        mergeVariables: {
          firstName: recipient.firstName,
          lastName: recipient.lastName || "",
          fullName: `${recipient.firstName} ${recipient.lastName || ""}`.trim(),
          qrCodeUrl: qrCodeImageUrl,
          claimCode,
        },
        addressPlacement: "top_first_page",
        doubleSided: true,
        color: true,
        description: description || `Test letter for ${passkitProgramId}`,
      });

      if (!letterResult.success) {
        console.error("Failed to send letter:", letterResult.error);
        res.status(500).json({
          success: false,
          error: {
            code: "POSTGRID_ERROR",
            message: letterResult.error || "Failed to send letter via PostGrid",
          },
        });
        return;
      }

      console.log(`✅ Letter sent successfully! ID: ${letterResult.letterId}`);

      res.status(200).json({
        success: true,
        data: {
          letter: {
            id: letterResult.letterId,
            status: letterResult.status,
            estimatedDeliveryDate: letterResult.estimatedDeliveryDate,
            previewUrl: `https://dashboard.postgrid.com/dashboard/letters/${letterResult.letterId}`,
          },
          claim: {
            claimCode,
            claimUrl,
            qrCodeUrl: qrCodeImageUrl,
          },
          passkit: {
            programId: passkitProgramId,
          },
          testInstructions: [
            "1. Open the Claim URL on your phone to test the pass installation",
            "2. Or scan the QR code at the qrCodeUrl with your phone camera",
            "3. You will be redirected to add the pass to Google Pay or Apple Wallet",
            "4. In PostGrid test mode, no physical letter is mailed",
          ],
        },
      });

    } catch (error) {
      console.error("Test send letter error:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Unknown error occurred",
        },
      });
    }
  }

  async sendPassKitEnrollmentLetter(req: Request, res: Response): Promise<void> {
    try {
      const enrollmentLetterSchema = z.object({
        passkitProgramId: z.string().min(1, "PassKit Program ID is required"),
        templateId: z.string().default("template_3J62GbmowSk7SeD4dFcaUs"),
        recipient: z.object({
          firstName: z.string().min(1, "First name is required"),
          lastName: z.string().optional(),
          email: z.string().email().optional(),
          addressLine1: z.string().min(1, "Address is required"),
          city: z.string().min(1, "City is required"),
          state: z.string().min(2).max(2, "State must be 2-letter code"),
          postalCode: z.string().min(5, "Postal code is required"),
        }),
        description: z.string().optional(),
      });

      const validation = enrollmentLetterSchema.safeParse(req.body);

      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request body",
            details: validation.error.errors,
          },
        });
        return;
      }

      const { passkitProgramId, templateId, recipient, description } = validation.data;

      console.log(`📧 Starting PassKit enrollment letter for program: ${passkitProgramId}`);

      const tierResult = await passKitService.getOrCreateDefaultTier(passkitProgramId);
      if (!tierResult.success || !tierResult.tierId) {
        res.status(500).json({
          success: false,
          error: {
            code: "TIER_NOT_FOUND",
            message: tierResult.error || "Could not find or create tier for PassKit program",
          },
        });
        return;
      }

      const tierId = tierResult.tierId;
      // Use shortCode-based URL if available, otherwise fallback to tier ID
      const passkitEnrollmentUrl = tierResult.enrollmentUrl || `https://pub2.pskt.io/c/${tierId}`;
      const qrCodeImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=450x450&qzone=1&data=${encodeURIComponent(passkitEnrollmentUrl)}`;

      console.log(`🎫 PassKit enrollment URL: ${passkitEnrollmentUrl}`);
      console.log(`📱 QR Code URL: ${qrCodeImageUrl}`);

      const letterResult = await postGridService.sendLetter({
        templateId,
        recipientAddress: {
          firstName: recipient.firstName,
          lastName: recipient.lastName,
          addressLine1: recipient.addressLine1,
          city: recipient.city,
          state: recipient.state,
          postalCode: recipient.postalCode,
          country: "US",
        },
        claimCode: `PASSKIT-${tierId}`,
        claimUrl: passkitEnrollmentUrl,
        mergeVariables: {
          firstName: recipient.firstName,
          lastName: recipient.lastName || "",
          fullName: `${recipient.firstName} ${recipient.lastName || ""}`.trim(),
          qrCodeUrl: qrCodeImageUrl,
          claimCode: `Scan to Join`,
        },
        addressPlacement: "top_first_page",
        doubleSided: true,
        color: true,
        description: description || `PassKit enrollment letter for ${passkitProgramId}`,
      });

      if (!letterResult.success) {
        console.error("Failed to send letter:", letterResult.error);
        res.status(500).json({
          success: false,
          error: {
            code: "POSTGRID_ERROR",
            message: letterResult.error || "Failed to send letter via PostGrid",
          },
        });
        return;
      }

      console.log(`✅ PassKit enrollment letter sent! ID: ${letterResult.letterId}`);

      res.status(200).json({
        success: true,
        data: {
          letter: {
            id: letterResult.letterId,
            status: letterResult.status,
            estimatedDeliveryDate: letterResult.estimatedDeliveryDate,
            previewUrl: `https://dashboard.postgrid.com/dashboard/letters/${letterResult.letterId}`,
          },
          passkit: {
            programId: passkitProgramId,
            tierId,
            enrollmentUrl: passkitEnrollmentUrl,
            qrCodeUrl: qrCodeImageUrl,
          },
          instructions: [
            "1. Recipient scans the QR code with their phone camera",
            "2. They are taken directly to PassKit to install their membership pass",
            "3. After installation, PassKit syncs the pass data to Supabase",
            "4. The member appears in your dashboard automatically",
          ],
        },
      });

    } catch (error) {
      console.error("Send PassKit enrollment letter error:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Unknown error occurred",
        },
      });
    }
  }

  async triggerPassKitSync(req: Request, res: Response): Promise<void> {
    try {
      const { programId } = req.params;
      const { fullSync = true } = req.body;

      if (!programId) {
        res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Program ID is required",
          },
        });
        return;
      }

      const client = supabaseService.getClient();
      const { data: program, error: programError } = await client
        .from("programs")
        .select("id, passkit_program_id, name")
        .eq("id", programId)
        .single();

      if (programError || !program) {
        res.status(404).json({
          success: false,
          error: {
            code: "PROGRAM_NOT_FOUND",
            message: "Program not found",
          },
        });
        return;
      }

      if (!program.passkit_program_id) {
        res.status(400).json({
          success: false,
          error: {
            code: "NO_PASSKIT_PROGRAM",
            message: "Program does not have a PassKit program ID configured",
          },
        });
        return;
      }

      if (!passKitSyncService.isConfigured()) {
        res.status(503).json({
          success: false,
          error: {
            code: "PASSKIT_NOT_CONFIGURED",
            message: "PassKit API keys are not configured",
          },
        });
        return;
      }

      console.log(`🔄 Triggering PassKit sync for program: ${program.name} (${programId})`);

      const result = await passKitSyncService.syncProgramMembers(
        programId,
        program.passkit_program_id,
        { fullSync }
      );

      res.status(result.success ? 200 : 500).json({
        success: result.success,
        data: {
          programId,
          programName: program.name,
          passkitProgramId: program.passkit_program_id,
          syncType: fullSync ? "FULL" : "DELTA",
          results: {
            synced: result.synced,
            created: result.created,
            updated: result.updated,
            failed: result.failed,
            durationMs: result.duration_ms,
          },
          errors: result.errors.length > 0 ? result.errors.slice(0, 10) : undefined,
        },
      });

    } catch (error) {
      console.error("Trigger PassKit sync error:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Unknown error occurred",
        },
      });
    }
  }

  async getPassKitSyncStatus(req: Request, res: Response): Promise<void> {
    try {
      const { programId } = req.params;

      if (!programId) {
        res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Program ID is required",
          },
        });
        return;
      }

      const syncState = await passKitSyncService.getSyncState(programId);

      if (!syncState) {
        res.status(200).json({
          success: true,
          data: {
            programId,
            status: "NEVER_SYNCED",
            message: "This program has never been synced with PassKit",
          },
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          programId,
          status: syncState.last_sync_status,
          syncEnabled: syncState.sync_enabled,
          lastFullSync: syncState.last_full_sync_at,
          lastDeltaSync: syncState.last_delta_sync_at,
          totalPassesSynced: syncState.total_passes_synced,
          lastError: syncState.last_sync_error,
        },
      });

    } catch (error) {
      console.error("Get PassKit sync status error:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Unknown error occurred",
        },
      });
    }
  }

  async getPassKitSyncHistory(req: Request, res: Response): Promise<void> {
    try {
      const { programId } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;

      if (!programId) {
        res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Program ID is required",
          },
        });
        return;
      }

      const client = supabaseService.getClient();
      const { data: events, error } = await client
        .from("passkit_event_journal")
        .select("*")
        .eq("program_id", programId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        console.error("Get sync history error:", error);
        res.status(500).json({
          success: false,
          error: {
            code: "DATABASE_ERROR",
            message: "Failed to fetch sync history",
          },
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          programId,
          events: events || [],
          count: events?.length || 0,
        },
      });

    } catch (error) {
      console.error("Get PassKit sync history error:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Unknown error occurred",
        },
      });
    }
  }

  async manuallyInsertPass(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    try {
      const manualPassSchema = z.object({
        programId: z.string().uuid("Program ID must be a valid UUID"),
        passkitInternalId: z.string().min(1, "PassKit internal ID is required"),
        externalId: z.string().optional(),
        email: z.string().email().optional(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        phone: z.string().optional(),
        pointsBalance: z.number().int().min(0).default(0),
      });

      const validation = manualPassSchema.safeParse(req.body);

      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request body",
            details: validation.error.errors,
          },
        });
        return;
      }

      const { 
        programId, 
        passkitInternalId, 
        externalId,
        email,
        firstName,
        lastName,
        phone,
      } = validation.data;

      const client = supabaseService.getClient();

      const { data: program, error: programError } = await client
        .from("programs")
        .select("id, tenant_id, passkit_program_id, name")
        .eq("id", programId)
        .single();

      if (programError || !program) {
        res.status(404).json({
          success: false,
          error: {
            code: "PROGRAM_NOT_FOUND",
            message: `Program ${programId} not found`,
          },
        });
        return;
      }

      const finalExternalId = externalId || passkitInternalId;

      const { data: rpcResult, error: rpcError } = await client.rpc("upsert_membership_pass_from_passkit", {
        p_program_id: programId,
        p_passkit_internal_id: passkitInternalId,
        p_external_id: finalExternalId,
        p_status: "INSTALLED",
        p_member_email: email || null,
        p_member_first_name: firstName || null,
        p_member_last_name: lastName || null,
        p_member_phone: phone || null,
        p_passkit_tier_name: null,
        p_passkit_created_at: new Date().toISOString(),
        p_passkit_updated_at: new Date().toISOString(),
      });

      if (rpcError) {
        console.error("Manual pass insert RPC error:", rpcError);
        res.status(500).json({
          success: false,
          error: {
            code: "DATABASE_ERROR",
            message: rpcError.message,
          },
        });
        return;
      }

      const result = rpcResult as { success: boolean; action?: string; pass_id?: string; error?: string };

      if (!result.success) {
        res.status(500).json({
          success: false,
          error: {
            code: "RPC_FAILED",
            message: result.error || "Failed to insert pass",
          },
        });
        return;
      }

      const processingTime = Date.now() - startTime;
      console.log(`✅ Pass ${result.action}: ${passkitInternalId} (id: ${result.pass_id})`);

      res.status(201).json({
        success: true,
        data: {
          passId: result.pass_id,
          externalId: finalExternalId,
          passkitInternalId,
          action: result.action,
          programId,
          programName: program.name,
        },
        metadata: {
          processingTime,
        },
      });

    } catch (error) {
      console.error("Manual pass insert error:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Unknown error occurred",
        },
      });
    }
  }

  async pushBalanceToPassKit(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();

    try {
      const pushBalanceSchema = z.object({
        passkitProgramId: z.string().min(1, "PassKit Program ID is required"),
        memberId: z.string().min(1, "PassKit Member ID (from pass) is required"),
        points: z.number().int().min(0, "Points must be a non-negative integer"),
        message: z.string().optional(),
        email: z.string().email().optional(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
      });

      const validation = pushBalanceSchema.safeParse(req.body);

      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request body",
            details: validation.error.errors,
          },
        });
        return;
      }

      const { passkitProgramId, memberId, points, message, email, firstName, lastName } = validation.data;

      console.log(`📤 Pushing balance to PassKit: ${memberId} = ${points} points`);

      const result = await passKitService.updateMemberPoints(
        passkitProgramId,
        memberId,
        points,
        message || `Balance updated to ${points} points`,
        { email, firstName, lastName }
      );

      const processingTime = Date.now() - startTime;

      if (!result.success) {
        res.status(500).json({
          success: false,
          error: {
            code: "PASSKIT_UPDATE_FAILED",
            message: result.error || "Failed to update PassKit",
          },
          metadata: { processingTime },
        });
        return;
      }

      console.log(`✅ PassKit balance updated: ${memberId} = ${points} points`);

      res.status(200).json({
        success: true,
        data: {
          memberId,
          points,
          passkitProgramId,
          message: message || `Balance updated to ${points} points`,
        },
        metadata: { processingTime },
      });
    } catch (error) {
      console.error("Push balance to PassKit error:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Unknown error occurred",
        },
      });
    }
  }

  async testPassKitProgram(req: Request, res: Response): Promise<void> {
    try {
      const { passkitProgramId } = req.params;
      
      console.log(`🔍 Testing PassKit program: ${passkitProgramId}`);
      
      const result = await passKitService.getProgram(passkitProgramId);
      
      res.status(result.success ? 200 : 404).json({
        success: result.success,
        data: result.program,
        error: result.error,
      });
    } catch (error) {
      console.error("Test PassKit program error:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  async testPassKitMember(req: Request, res: Response): Promise<void> {
    try {
      const { passkitProgramId, memberId } = req.params;
      
      console.log(`🔍 Testing PassKit member lookup: ${memberId} in program ${passkitProgramId}`);
      
      const result = await passKitSyncService.syncSinglePass(
        passkitProgramId,
        passkitProgramId,
        memberId
      );
      
      res.status(result.success ? 200 : 404).json({
        success: result.success,
        action: result.action,
        error: result.error,
      });
    } catch (error) {
      console.error("Test PassKit member error:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}

export const adminController = new AdminController();
