import type { Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";
import { config, isSupabaseConfigured } from "../config";
import { adminService } from "../services/admin.service";
import { z } from "zod";

const provisionTenantSchema = z.object({
  businessName: z.string().min(1, "Business name is required"),
  email: z.string().email("Valid email is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  passkitProgramId: z.string().min(1, "PassKit Program ID is required"),
  protocol: z.enum(["MEMBERSHIP", "COUPON", "EVENT_TICKET"]).default("MEMBERSHIP"),
});

const ALLOWED_ADMIN_ROLES = ["SUPER_ADMIN", "PLATFORM_ADMIN"];

class ClientController {
  async login(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();

    try {
      if (!isSupabaseConfigured()) {
        res.status(503).json({
          success: false,
          error: {
            code: "SERVICE_UNAVAILABLE",
            message: "Database service not configured",
          },
        });
        return;
      }

      const { email, password } = req.body;

      if (!email || !password) {
        res.status(400).json({
          success: false,
          error: {
            code: "MISSING_CREDENTIALS",
            message: "Email and password are required",
          },
        });
        return;
      }

      const supabase = createClient(
        config.supabase.url,
        config.supabase.anonKey || config.supabase.serviceRoleKey
      );

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError || !authData.session) {
        res.status(401).json({
          success: false,
          error: {
            code: "INVALID_CREDENTIALS",
            message: authError?.message || "Invalid email or password",
          },
        });
        return;
      }

      const processingTime = Date.now() - startTime;

      res.status(200).json({
        success: true,
        data: {
          token: authData.session.access_token,
          user: {
            id: authData.user.id,
            email: authData.user.email,
          },
        },
        metadata: {
          processingTime,
        },
      });

    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Unknown error occurred",
        },
      });
    }
  }

  async getMe(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();

    try {
      if (!isSupabaseConfigured()) {
        res.status(503).json({
          success: false,
          error: {
            code: "SERVICE_UNAVAILABLE",
            message: "Database service not configured",
          },
        });
        return;
      }

      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res.status(401).json({
          success: false,
          error: {
            code: "MISSING_TOKEN",
            message: "Authorization header with Bearer token is required",
          },
        });
        return;
      }

      const token = authHeader.substring(7);

      const supabase = createClient(
        config.supabase.url,
        config.supabase.anonKey || config.supabase.serviceRoleKey,
        {
          global: {
            headers: { Authorization: `Bearer ${token}` },
          },
        }
      );

      const { data: userData, error: userError } = await supabase.auth.getUser(token);

      if (userError || !userData.user) {
        res.status(401).json({
          success: false,
          error: {
            code: "INVALID_TOKEN",
            message: userError?.message || "Invalid or expired token",
          },
        });
        return;
      }

      const userId = userData.user.id;

      const serviceClient = createClient(
        config.supabase.url,
        config.supabase.serviceRoleKey,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        }
      );

      const { data: profile, error: profileError } = await serviceClient
        .from("admin_profiles")
        .select(`
          id,
          role,
          created_at,
          programs:program_id (
            id,
            name,
            passkit_program_id,
            passkit_tier_id,
            protocol,
            is_suspended,
            birthday_message,
            created_at
          )
        `)
        .eq("id", userId)
        .single();

      if (profileError || !profile) {
        res.status(404).json({
          success: false,
          error: {
            code: "PROFILE_NOT_FOUND",
            message: "No program associated with this user",
          },
        });
        return;
      }

      const program = profile.programs as any;
      const processingTime = Date.now() - startTime;

      res.status(200).json({
        success: true,
        data: {
          userId: profile.id,
          role: profile.role,
          programId: program?.id,
          programName: program?.name,
          passkitProgramId: program?.passkit_program_id,
          passkitTierId: program?.passkit_tier_id,
          protocol: program?.protocol,
          isSuspended: program?.is_suspended || false,
          birthdayMessage: program?.birthday_message,
          createdAt: profile.created_at,
        },
        metadata: {
          processingTime,
        },
      });

    } catch (error) {
      console.error("Get client context error:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Unknown error occurred",
        },
      });
    }
  }

  async getAnalytics(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();

    try {
      if (!isSupabaseConfigured()) {
        res.status(503).json({
          success: false,
          error: {
            code: "SERVICE_UNAVAILABLE",
            message: "Database service not configured",
          },
        });
        return;
      }

      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res.status(401).json({
          success: false,
          error: {
            code: "MISSING_TOKEN",
            message: "Authorization header with Bearer token is required",
          },
        });
        return;
      }

      const token = authHeader.substring(7);

      const supabase = createClient(
        config.supabase.url,
        config.supabase.anonKey || config.supabase.serviceRoleKey,
        {
          global: {
            headers: { Authorization: `Bearer ${token}` },
          },
        }
      );

      const { data: userData, error: userError } = await supabase.auth.getUser(token);

      if (userError || !userData.user) {
        res.status(401).json({
          success: false,
          error: {
            code: "INVALID_TOKEN",
            message: userError?.message || "Invalid or expired token",
          },
        });
        return;
      }

      const userId = userData.user.id;

      const serviceClient = createClient(
        config.supabase.url,
        config.supabase.serviceRoleKey,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        }
      );

      const { data: profile } = await serviceClient
        .from("admin_profiles")
        .select("program_id")
        .eq("id", userId)
        .single();

      if (!profile?.program_id) {
        res.status(404).json({
          success: false,
          error: {
            code: "PROGRAM_NOT_FOUND",
            message: "No program associated with this user",
          },
        });
        return;
      }

      const { data: analytics, error: analyticsError } = await serviceClient
        .from("passes_master")
        .select("enrollment_source, status")
        .eq("program_id", profile.program_id);

      if (analyticsError) {
        console.error("Analytics query error:", analyticsError);
        res.status(500).json({
          success: false,
          error: {
            code: "QUERY_FAILED",
            message: analyticsError.message,
          },
        });
        return;
      }

      const sourceBreakdown: Record<string, { total: number; active: number; churned: number }> = {};
      
      for (const pass of analytics || []) {
        const source = pass.enrollment_source || "UNKNOWN";
        if (!sourceBreakdown[source]) {
          sourceBreakdown[source] = { total: 0, active: 0, churned: 0 };
        }
        sourceBreakdown[source].total++;
        if (pass.status === "INSTALLED") {
          sourceBreakdown[source].active++;
        } else if (pass.status === "UNINSTALLED") {
          sourceBreakdown[source].churned++;
        }
      }

      const totals = {
        total: analytics?.length || 0,
        active: analytics?.filter(p => p.status === "INSTALLED").length || 0,
        churned: analytics?.filter(p => p.status === "UNINSTALLED").length || 0,
      };

      const processingTime = Date.now() - startTime;

      res.status(200).json({
        success: true,
        data: {
          programId: profile.program_id,
          totals,
          bySource: sourceBreakdown,
          sources: {
            csv: sourceBreakdown["CSV"] || { total: 0, active: 0, churned: 0 },
            smartpass: sourceBreakdown["SMARTPASS"] || { total: 0, active: 0, churned: 0 },
            claimCode: sourceBreakdown["CLAIM_CODE"] || { total: 0, active: 0, churned: 0 },
          },
        },
        metadata: {
          processingTime,
        },
      });

    } catch (error) {
      console.error("Get analytics error:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Unknown error occurred",
        },
      });
    }
  }

  async getMembers(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();

    try {
      if (!isSupabaseConfigured()) {
        res.status(503).json({
          success: false,
          error: {
            code: "SERVICE_UNAVAILABLE",
            message: "Database service not configured",
          },
        });
        return;
      }

      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res.status(401).json({
          success: false,
          error: {
            code: "MISSING_TOKEN",
            message: "Authorization header with Bearer token is required",
          },
        });
        return;
      }

      const token = authHeader.substring(7);

      const supabase = createClient(
        config.supabase.url,
        config.supabase.anonKey || config.supabase.serviceRoleKey,
        {
          global: {
            headers: { Authorization: `Bearer ${token}` },
          },
        }
      );

      const { data: userData, error: userError } = await supabase.auth.getUser(token);

      if (userError || !userData.user) {
        res.status(401).json({
          success: false,
          error: {
            code: "INVALID_TOKEN",
            message: userError?.message || "Invalid or expired token",
          },
        });
        return;
      }

      const userId = userData.user.id;

      const serviceClient = createClient(
        config.supabase.url,
        config.supabase.serviceRoleKey,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        }
      );

      const { data: profile } = await serviceClient
        .from("admin_profiles")
        .select("program_id")
        .eq("id", userId)
        .single();

      if (!profile?.program_id) {
        res.status(404).json({
          success: false,
          error: {
            code: "PROGRAM_NOT_FOUND",
            message: "No program associated with this user",
          },
        });
        return;
      }

      const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
      const offset = parseInt(req.query.offset as string) || 0;
      const searchQuery = req.query.q as string;

      let query = serviceClient
        .from("passes_master")
        .select(`
          id,
          external_id,
          status,
          is_active,
          enrollment_source,
          last_updated
        `, { count: "exact" })
        .eq("program_id", profile.program_id);

      if (searchQuery) {
        query = query.or(`external_id.ilike.%${searchQuery}%`);
      }

      query = query.range(offset, offset + limit - 1);

      const { data: passes, error: queryError, count } = await query;

      if (queryError) {
        console.error("Members query error:", queryError);
        res.status(500).json({
          success: false,
          error: {
            code: "QUERY_FAILED",
            message: queryError.message,
          },
        });
        return;
      }

      const members = (passes || []).map((p: any) => ({
        id: p.id,
        external_id: p.external_id,
        first_name: "Member",
        last_name: "",
        email: "",
        phone: null,
        points_balance: 0,
        tier_name: "Standard",
        status: p.status || "UNKNOWN",
        enrollment_source: p.enrollment_source || "UNKNOWN",
        created_at: p.last_updated || new Date().toISOString(),
      }));

      const processingTime = Date.now() - startTime;

      res.status(200).json({
        success: true,
        data: {
          members,
          count: count || members.length,
        },
        metadata: {
          processingTime,
        },
      });

    } catch (error) {
      console.error("Get members error:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Unknown error occurred",
        },
      });
    }
  }

  async getCampaigns(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();

    try {
      if (!isSupabaseConfigured()) {
        res.status(503).json({
          success: false,
          error: {
            code: "SERVICE_UNAVAILABLE",
            message: "Database service not configured",
          },
        });
        return;
      }

      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res.status(401).json({
          success: false,
          error: {
            code: "MISSING_TOKEN",
            message: "Authorization header with Bearer token is required",
          },
        });
        return;
      }

      const token = authHeader.substring(7);

      const supabase = createClient(
        config.supabase.url,
        config.supabase.anonKey || config.supabase.serviceRoleKey,
        {
          global: {
            headers: { Authorization: `Bearer ${token}` },
          },
        }
      );

      const { data: userData, error: userError } = await supabase.auth.getUser(token);

      if (userError || !userData.user) {
        res.status(401).json({
          success: false,
          error: {
            code: "INVALID_TOKEN",
            message: userError?.message || "Invalid or expired token",
          },
        });
        return;
      }

      const userId = userData.user.id;

      const serviceClient = createClient(
        config.supabase.url,
        config.supabase.serviceRoleKey,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        }
      );

      const { data: profile } = await serviceClient
        .from("admin_profiles")
        .select("program_id")
        .eq("id", userId)
        .single();

      if (!profile?.program_id) {
        res.status(404).json({
          success: false,
          error: {
            code: "PROGRAM_NOT_FOUND",
            message: "No program associated with this user",
          },
        });
        return;
      }

      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

      const { data: campaigns, error: queryError } = await serviceClient
        .from("notification_logs")
        .select("*")
        .eq("program_id", profile.program_id)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (queryError) {
        console.error("Campaigns query error:", queryError);
        res.status(500).json({
          success: false,
          error: {
            code: "QUERY_FAILED",
            message: queryError.message,
          },
        });
        return;
      }

      const formattedCampaigns = (campaigns || []).map((c: any) => ({
        id: c.id,
        name: c.campaign_name || "Unnamed Campaign",
        recipientCount: c.recipient_count || 0,
        successCount: c.success_count || 0,
        failedCount: c.failed_count || 0,
        message: c.message_content,
        targetSegment: c.target_segment || "All Members",
        createdAt: c.created_at,
        successRate: c.recipient_count > 0 
          ? Math.round((c.success_count / c.recipient_count) * 100) 
          : 0,
      }));

      const processingTime = Date.now() - startTime;

      res.status(200).json({
        success: true,
        data: {
          campaigns: formattedCampaigns,
          count: formattedCampaigns.length,
        },
        metadata: {
          processingTime,
        },
      });

    } catch (error) {
      console.error("Get campaigns error:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Unknown error occurred",
        },
      });
    }
  }

  private async validateAdminAccess(req: Request, res: Response): Promise<{ userId: string; role: string } | null> {
    if (!isSupabaseConfigured()) {
      res.status(503).json({
        success: false,
        error: {
          code: "SERVICE_UNAVAILABLE",
          message: "Database service not configured",
        },
      });
      return null;
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({
        success: false,
        error: {
          code: "MISSING_TOKEN",
          message: "Authorization header with Bearer token is required",
        },
      });
      return null;
    }

    const token = authHeader.substring(7);

    const supabase = createClient(
      config.supabase.url,
      config.supabase.anonKey || config.supabase.serviceRoleKey,
      {
        global: {
          headers: { Authorization: `Bearer ${token}` },
        },
      }
    );

    const { data: userData, error: userError } = await supabase.auth.getUser(token);

    if (userError || !userData.user) {
      res.status(401).json({
        success: false,
        error: {
          code: "INVALID_TOKEN",
          message: userError?.message || "Invalid or expired token",
        },
      });
      return null;
    }

    const userId = userData.user.id;

    const serviceClient = createClient(
      config.supabase.url,
      config.supabase.serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { data: profile } = await serviceClient
      .from("admin_profiles")
      .select("role")
      .eq("id", userId)
      .single();

    const userRole = profile?.role || "CLIENT_ADMIN";

    if (!ALLOWED_ADMIN_ROLES.includes(userRole)) {
      res.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "You do not have permission to access this resource",
        },
      });
      return null;
    }

    return { userId, role: userRole };
  }

  async getTenantsAsAdmin(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();

    try {
      const admin = await this.validateAdminAccess(req, res);
      if (!admin) return;

      const result = await adminService.listTenants();

      const processingTime = Date.now() - startTime;

      if (!result.success) {
        res.status(500).json({
          success: false,
          error: {
            code: "LIST_FAILED",
            message: result.error,
          },
          metadata: { processingTime },
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          tenants: result.tenants,
          count: result.tenants?.length || 0,
        },
        metadata: { processingTime },
      });

    } catch (error) {
      console.error("Get tenants error:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Unknown error occurred",
        },
      });
    }
  }

  async provisionTenantAsAdmin(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();

    try {
      const admin = await this.validateAdminAccess(req, res);
      if (!admin) return;

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

      const { businessName, email, password, passkitProgramId, protocol } = validation.data;

      const result = await adminService.createTenant({
        businessName,
        email,
        password,
        passkitProgramId,
        protocol,
      });

      const processingTime = Date.now() - startTime;

      if (!result.success) {
        const statusCode = result.error?.includes("already") ? 409 : 500;
        res.status(statusCode).json({
          success: false,
          error: {
            code: statusCode === 409 ? "DUPLICATE_ERROR" : "PROVISIONING_FAILED",
            message: result.error,
          },
          metadata: { processingTime },
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
        },
        metadata: { processingTime },
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

  async deleteTenantAsAdmin(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();

    try {
      const admin = await this.validateAdminAccess(req, res);
      if (!admin) return;

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

      const processingTime = Date.now() - startTime;

      if (!result.success) {
        res.status(500).json({
          success: false,
          error: {
            code: "DELETE_FAILED",
            message: result.error,
          },
          metadata: { processingTime },
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Tenant deleted successfully",
        metadata: { processingTime },
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

export const clientController = new ClientController();
