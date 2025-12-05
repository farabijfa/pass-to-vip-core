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
        res.status(statusCode).json({
          success: false,
          error: {
            code: statusCode === 409 ? "DUPLICATE_EMAIL" : "PROVISIONING_FAILED",
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
}

export const adminController = new AdminController();
