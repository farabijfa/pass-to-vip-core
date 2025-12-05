import { Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";
import { config, isSupabaseConfigured } from "../config";

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

      const { data: program, error } = await supabase
        .from("programs")
        .select("id, name, protocol, enrollment_url, is_suspended")
        .eq("dashboard_slug", slug)
        .single();

      if (error) {
        if (error.code === "42703" || error.message?.includes("dashboard_slug")) {
          console.warn("dashboard_slug column not found - migration may be pending");
          res.status(503).json({
            success: false,
            error: { 
              code: "MIGRATION_PENDING",
              message: "This feature is not yet available. Please try again later." 
            },
          });
          return;
        }
        
        if (error.code === "PGRST116") {
          res.status(404).json({
            success: false,
            error: { message: "Program not found" },
          });
          return;
        }

        console.error("Enrollment lookup error:", error);
        res.status(500).json({
          success: false,
          error: { message: "Internal server error" },
        });
        return;
      }

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
