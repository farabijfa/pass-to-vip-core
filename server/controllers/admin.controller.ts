import type { Request, Response } from "express";
import { adminService } from "../services/admin.service";
import { z } from "zod";

const provisionTenantSchema = z.object({
  businessName: z.string().min(1, "Business name is required"),
  email: z.string().email("Valid email is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  passkitProgramId: z.string().optional(),
  passkitTierId: z.string().optional(),
  protocol: z.enum(["MEMBERSHIP", "COUPON", "EVENT_TICKET"]).default("MEMBERSHIP"),
  timezone: z.string().default("America/New_York"),
  autoProvision: z.boolean().default(true),
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
}

export const adminController = new AdminController();
