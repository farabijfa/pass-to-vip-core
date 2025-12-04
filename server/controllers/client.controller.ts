import type { Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";
import { config, isSupabaseConfigured } from "../config";

class ClientController {
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
          points_balance,
          tier_name,
          enrollment_source,
          member_email,
          member_first_name,
          member_last_name,
          member_phone,
          created_at,
          last_updated
        `, { count: "exact" })
        .eq("program_id", profile.program_id);

      if (searchQuery) {
        query = query.or(`external_id.ilike.%${searchQuery}%,member_email.ilike.%${searchQuery}%,member_first_name.ilike.%${searchQuery}%,member_last_name.ilike.%${searchQuery}%`);
      }

      query = query.order("last_updated", { ascending: false }).range(offset, offset + limit - 1);

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
        first_name: p.member_first_name || "Unknown",
        last_name: p.member_last_name || "",
        email: p.member_email || "",
        phone: p.member_phone || null,
        points_balance: p.points_balance || 0,
        tier_name: p.tier_name || "Standard",
        status: p.status || "UNKNOWN",
        enrollment_source: p.enrollment_source || "UNKNOWN",
        created_at: p.created_at,
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
}

export const clientController = new ClientController();
