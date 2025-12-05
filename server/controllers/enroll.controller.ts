import { Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";
import { config, isSupabaseConfigured } from "../config";

interface PublicProgramInfo {
  id: string;
  name: string;
  protocol: string;
  enrollment_url: string | null;
  is_suspended: boolean;
}

class EnrollController {
  private anonClient: ReturnType<typeof createClient> | null = null;

  private isAnonKeyConfigured(): boolean {
    return !!(config.supabase.url && config.supabase.anonKey);
  }

  private getAnonClient() {
    if (this.anonClient) return this.anonClient;
    
    if (!config.supabase.url || !config.supabase.anonKey) {
      throw new Error("Supabase anon key not configured - required for public endpoints");
    }

    this.anonClient = createClient(config.supabase.url, config.supabase.anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    return this.anonClient;
  }

  async getBySlug(req: Request, res: Response): Promise<void> {
    try {
      const { slug } = req.params;

      if (!slug) {
        res.status(400).json({
          success: false,
          error: { message: "Slug is required" },
        });
        return;
      }

      if (!this.isAnonKeyConfigured()) {
        res.status(503).json({
          success: false,
          error: { 
            code: "SERVICE_UNAVAILABLE",
            message: "This feature is temporarily unavailable. Please try again later." 
          },
        });
        return;
      }

      const supabase = this.getAnonClient();

      // Use secure RPC function instead of direct table access
      // This ensures anon key cannot access tables directly
      const { data: programs, error } = await supabase
        .rpc('get_public_program_info', { p_slug: slug.toLowerCase().trim() } as any);

      if (error) {
        // Handle case where RPC function doesn't exist (migration not run)
        if (error.code === "42883" || error.message?.includes("function") && error.message?.includes("does not exist")) {
          console.warn("get_public_program_info function not found - run migration 012");
          
          // Fallback to direct query for backwards compatibility (pre-migration)
          // This will be blocked by RLS after migration is applied
          const { data: fallbackProgram, error: fallbackError } = await supabase
            .from("programs")
            .select("id, name, protocol, enrollment_url, is_suspended")
            .eq("dashboard_slug", slug.toLowerCase().trim())
            .single();

          if (fallbackError) {
            if (fallbackError.code === "42703" || fallbackError.message?.includes("dashboard_slug")) {
              console.warn("dashboard_slug column not found - run migration 010");
              res.status(503).json({
                success: false,
                error: { 
                  code: "MIGRATION_PENDING",
                  message: "This feature is not yet available. Please try again later." 
                },
              });
              return;
            }
            
            if (fallbackError.code === "PGRST116") {
              res.status(404).json({
                success: false,
                error: { message: "Program not found" },
              });
              return;
            }

            console.error("Enrollment lookup fallback error:", fallbackError);
            res.status(500).json({
              success: false,
              error: { message: "Internal server error" },
            });
            return;
          }

          if (!fallbackProgram) {
            res.status(404).json({
              success: false,
              error: { message: "Program not found" },
            });
            return;
          }

          res.json({
            success: true,
            data: fallbackProgram,
          });
          return;
        }

        // Permission denied - RLS is blocking access (expected after migration)
        if (error.code === "42501" || error.message?.includes("permission denied")) {
          console.error("RLS blocking anon access - check RPC function permissions");
          res.status(503).json({
            success: false,
            error: { 
              code: "ACCESS_DENIED",
              message: "This feature is temporarily unavailable. Please try again later." 
            },
          });
          return;
        }

        console.error("Enrollment RPC lookup error:", error);
        res.status(500).json({
          success: false,
          error: { message: "Internal server error" },
        });
        return;
      }

      // RPC returns an array, get the first (and only) result
      const program: PublicProgramInfo | undefined = Array.isArray(programs) ? programs[0] : programs;

      if (!program) {
        res.status(404).json({
          success: false,
          error: { message: "Program not found" },
        });
        return;
      }

      res.json({
        success: true,
        data: program,
      });
    } catch (error) {
      console.error("Enrollment lookup error:", error);
      res.status(500).json({
        success: false,
        error: { message: "Internal server error" },
      });
    }
  }
}

export const enrollController = new EnrollController();
