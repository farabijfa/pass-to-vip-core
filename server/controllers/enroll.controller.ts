import { Request, Response } from "express";
import { supabaseService } from "../services/supabase.service";

interface PublicProgramInfo {
  id: string;
  name: string;
  protocol: string;
  enrollment_url: string | null;
  is_suspended: boolean;
}

class EnrollController {
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

      console.log(`🔍 Looking up program by dashboard_slug: "${slug}"`);

      const supabase = supabaseService.getClient();

      const { data: program, error } = await supabase
        .from("programs")
        .select("id, name, protocol, enrollment_url, is_suspended")
        .eq("dashboard_slug", slug)
        .single();

      console.log(`📊 Program lookup result: program=${JSON.stringify(program)}, error=${JSON.stringify(error)}`);

      if (error) {
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
