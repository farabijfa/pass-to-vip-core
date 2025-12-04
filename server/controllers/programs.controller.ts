import type { Request, Response, NextFunction } from "express";
import { supabaseService } from "../services";
import { generate } from "short-uuid";
import QRCode from "qrcode";

function createResponse<T>(
  success: boolean,
  data?: T,
  error?: { code: string; message: string; details?: any },
  requestId?: string
) {
  return {
    success,
    data,
    error,
    metadata: {
      requestId: requestId || generate(),
      timestamp: new Date().toISOString(),
    },
  };
}

class ProgramsController {
  async getProgram(req: Request, res: Response, next: NextFunction) {
    const requestId = (req.headers["x-request-id"] as string) || generate();

    try {
      const { programId } = req.params;

      if (!programId) {
        return res.status(400).json(
          createResponse(
            false,
            undefined,
            {
              code: "INVALID_REQUEST",
              message: "Program ID is required",
            },
            requestId
          )
        );
      }

      const client = supabaseService.getClient();
      
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(programId);

      let query = client
        .from("programs")
        .select(`
          id,
          name,
          passkit_program_id,
          birthday_bot_enabled,
          birthday_reward_points,
          birthday_message,
          enrollment_url,
          is_suspended,
          protocol,
          created_at
        `);

      if (isUuid) {
        query = query.eq("id", programId);
      } else {
        query = query.eq("passkit_program_id", programId);
      }

      const { data: program, error } = await query.limit(1);

      const foundProgram = program?.[0];

      if (error || !foundProgram) {
        return res.status(404).json(
          createResponse(
            false,
            undefined,
            {
              code: "PROGRAM_NOT_FOUND",
              message: error?.message || "Program not found",
            },
            requestId
          )
        );
      }

      return res.status(200).json(
        createResponse(
          true,
          {
            program: foundProgram,
          },
          undefined,
          requestId
        )
      );
    } catch (error) {
      console.error("Get program error:", error);
      return res.status(500).json(
        createResponse(
          false,
          undefined,
          {
            code: "INTERNAL_ERROR",
            message: "An unexpected error occurred",
          },
          requestId
        )
      );
    }
  }

  async updateProgram(req: Request, res: Response, next: NextFunction) {
    const requestId = (req.headers["x-request-id"] as string) || generate();

    try {
      const { programId } = req.params;
      const updates = req.body;

      if (!programId) {
        return res.status(400).json(
          createResponse(
            false,
            undefined,
            {
              code: "INVALID_REQUEST",
              message: "Program ID is required",
            },
            requestId
          )
        );
      }

      const allowedFields = [
        "birthday_bot_enabled",
        "birthday_reward_points",
        "birthday_message",
        "name",
        "is_suspended",
        "enrollment_url",
      ];

      const sanitizedUpdates: Record<string, any> = {};
      for (const key of Object.keys(updates)) {
        if (allowedFields.includes(key)) {
          sanitizedUpdates[key] = updates[key];
        }
      }

      if (Object.keys(sanitizedUpdates).length === 0) {
        return res.status(400).json(
          createResponse(
            false,
            undefined,
            {
              code: "INVALID_REQUEST",
              message: "No valid fields to update. Allowed: " + allowedFields.join(", "),
            },
            requestId
          )
        );
      }

      const client = supabaseService.getClient();
      
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(programId);

      let query = client
        .from("programs")
        .update(sanitizedUpdates)
        .select(`
          id,
          name,
          passkit_program_id,
          birthday_bot_enabled,
          birthday_reward_points,
          birthday_message,
          enrollment_url,
          is_suspended,
          protocol
        `);

      if (isUuid) {
        query = query.eq("id", programId);
      } else {
        query = query.eq("passkit_program_id", programId);
      }

      const { data: program, error } = await query.limit(1);

      const updatedProgram = program?.[0];

      if (error || !updatedProgram) {
        console.error("Update program error:", error);
        return res.status(404).json(
          createResponse(
            false,
            undefined,
            {
              code: "PROGRAM_NOT_FOUND",
              message: error?.message || "Program not found or update failed",
            },
            requestId
          )
        );
      }

      console.log(`✅ Program ${programId} updated:`, sanitizedUpdates);

      return res.status(200).json(
        createResponse(
          true,
          {
            program: updatedProgram,
            updatedFields: Object.keys(sanitizedUpdates),
          },
          undefined,
          requestId
        )
      );
    } catch (error) {
      console.error("Update program error:", error);
      return res.status(500).json(
        createResponse(
          false,
          undefined,
          {
            code: "INTERNAL_ERROR",
            message: "An unexpected error occurred",
          },
          requestId
        )
      );
    }
  }

  async listPrograms(req: Request, res: Response, next: NextFunction) {
    const requestId = (req.headers["x-request-id"] as string) || generate();

    try {
      const client = supabaseService.getClient();

      const { data: programs, error } = await client
        .from("programs")
        .select(`
          id,
          name,
          passkit_program_id,
          birthday_bot_enabled,
          birthday_reward_points,
          birthday_message,
          enrollment_url,
          is_suspended,
          protocol,
          created_at
        `)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("List programs error:", error);
        return res.status(500).json(
          createResponse(
            false,
            undefined,
            {
              code: "DATABASE_ERROR",
              message: error.message,
            },
            requestId
          )
        );
      }

      return res.status(200).json(
        createResponse(
          true,
          {
            programs: programs || [],
            count: programs?.length || 0,
          },
          undefined,
          requestId
        )
      );
    } catch (error) {
      console.error("List programs error:", error);
      return res.status(500).json(
        createResponse(
          false,
          undefined,
          {
            code: "INTERNAL_ERROR",
            message: "An unexpected error occurred",
          },
          requestId
        )
      );
    }
  }

  async generateQRCode(req: Request, res: Response, next: NextFunction) {
    const requestId = (req.headers["x-request-id"] as string) || generate();

    try {
      const { programId } = req.params;
      const format = (req.query.format as string) || "png";
      const size = parseInt(req.query.size as string) || 300;

      if (!programId) {
        return res.status(400).json(
          createResponse(false, undefined, {
            code: "INVALID_REQUEST",
            message: "Program ID is required",
          }, requestId)
        );
      }

      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(programId);
      if (!isUuid) {
        return res.status(400).json(
          createResponse(false, undefined, {
            code: "INVALID_REQUEST",
            message: "programId must be a valid UUID format",
          }, requestId)
        );
      }

      const client = supabaseService.getClient();
      const { data: program, error } = await client
        .from("programs")
        .select("id, name, enrollment_url, is_suspended")
        .eq("id", programId)
        .single();

      if (error || !program) {
        return res.status(404).json(
          createResponse(false, undefined, {
            code: "PROGRAM_NOT_FOUND",
            message: "Program not found",
          }, requestId)
        );
      }

      if (program.is_suspended) {
        return res.status(403).json(
          createResponse(false, undefined, {
            code: "PROGRAM_SUSPENDED",
            message: "Program is suspended. QR code generation disabled.",
          }, requestId)
        );
      }

      if (!program.enrollment_url) {
        return res.status(400).json(
          createResponse(false, undefined, {
            code: "NO_ENROLLMENT_URL",
            message: "No enrollment URL configured for this program. Set enrollment_url first.",
          }, requestId)
        );
      }

      const qrOptions = {
        width: Math.min(Math.max(size, 100), 1000),
        margin: 2,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      };

      if (format === "svg") {
        const svg = await QRCode.toString(program.enrollment_url, { type: "svg", ...qrOptions });
        res.setHeader("Content-Type", "image/svg+xml");
        res.setHeader("Content-Disposition", `inline; filename="${program.name.replace(/[^a-z0-9]/gi, "_")}_qr.svg"`);
        return res.send(svg);
      } else if (format === "dataurl") {
        const dataUrl = await QRCode.toDataURL(program.enrollment_url, qrOptions);
        return res.status(200).json(
          createResponse(true, {
            qrCode: dataUrl,
            enrollmentUrl: program.enrollment_url,
            programName: program.name,
            format: "dataurl",
            size: qrOptions.width,
          }, undefined, requestId)
        );
      } else {
        const buffer = await QRCode.toBuffer(program.enrollment_url, qrOptions);
        res.setHeader("Content-Type", "image/png");
        res.setHeader("Content-Disposition", `inline; filename="${program.name.replace(/[^a-z0-9]/gi, "_")}_qr.png"`);
        return res.send(buffer);
      }
    } catch (error) {
      console.error("Generate QR code error:", error);
      return res.status(500).json(
        createResponse(false, undefined, {
          code: "INTERNAL_ERROR",
          message: "Failed to generate QR code",
        }, requestId)
      );
    }
  }

  async getMembers(req: Request, res: Response, next: NextFunction) {
    const requestId = (req.headers["x-request-id"] as string) || generate();

    try {
      const { programId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const search = (req.query.search as string) || "";
      const enrollmentSource = req.query.source as string;
      const status = req.query.status as string;

      if (!programId) {
        return res.status(400).json(
          createResponse(false, undefined, {
            code: "INVALID_REQUEST",
            message: "Program ID is required",
          }, requestId)
        );
      }

      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(programId);
      if (!isUuid) {
        return res.status(400).json(
          createResponse(false, undefined, {
            code: "INVALID_REQUEST",
            message: "programId must be a valid UUID format",
          }, requestId)
        );
      }

      const client = supabaseService.getClient();

      const { data: program, error: programError } = await client
        .from("programs")
        .select("id, name")
        .eq("id", programId)
        .single();

      if (programError || !program) {
        return res.status(404).json(
          createResponse(false, undefined, {
            code: "PROGRAM_NOT_FOUND",
            message: "Program not found",
          }, requestId)
        );
      }

      const offset = (page - 1) * limit;

      let query = client
        .from("passes_master")
        .select(`
          id,
          external_id,
          passkit_internal_id,
          status,
          is_active,
          enrollment_source,
          member_email,
          member_first_name,
          member_last_name,
          points_balance,
          last_updated,
          user_id,
          users (
            id,
            email,
            first_name,
            last_name,
            birth_date,
            phone_number
          )
        `, { count: "exact" })
        .eq("program_id", programId)
        .order("last_updated", { ascending: false });

      if (search) {
        query = query.or(`member_email.ilike.%${search}%,member_first_name.ilike.%${search}%,member_last_name.ilike.%${search}%,external_id.ilike.%${search}%`);
      }

      if (enrollmentSource) {
        query = query.eq("enrollment_source", enrollmentSource.toUpperCase());
      }

      if (status) {
        query = query.eq("status", status.toUpperCase());
      }

      const { data: members, error, count } = await query.range(offset, offset + limit - 1);

      if (error) {
        console.error("Get members error:", error);
        return res.status(500).json(
          createResponse(false, undefined, {
            code: "DATABASE_ERROR",
            message: error.message,
          }, requestId)
        );
      }

      return res.status(200).json(
        createResponse(true, {
          members: members || [],
          pagination: {
            page,
            limit,
            total: count || 0,
            totalPages: Math.ceil((count || 0) / limit),
            hasMore: offset + limit < (count || 0),
          },
          filters: {
            search: search || null,
            enrollmentSource: enrollmentSource || null,
            status: status || null,
          },
        }, undefined, requestId)
      );
    } catch (error) {
      console.error("Get members error:", error);
      return res.status(500).json(
        createResponse(false, undefined, {
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred",
        }, requestId)
      );
    }
  }

  async updateEnrollmentUrl(req: Request, res: Response, next: NextFunction) {
    const requestId = (req.headers["x-request-id"] as string) || generate();

    try {
      const { programId } = req.params;
      const { enrollment_url } = req.body;

      if (!programId) {
        return res.status(400).json(
          createResponse(false, undefined, {
            code: "INVALID_REQUEST",
            message: "Program ID is required",
          }, requestId)
        );
      }

      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(programId);
      if (!isUuid) {
        return res.status(400).json(
          createResponse(false, undefined, {
            code: "INVALID_REQUEST",
            message: "programId must be a valid UUID format",
          }, requestId)
        );
      }

      if (!enrollment_url || typeof enrollment_url !== "string") {
        return res.status(400).json(
          createResponse(false, undefined, {
            code: "INVALID_REQUEST",
            message: "enrollment_url is required and must be a string",
          }, requestId)
        );
      }

      try {
        const url = new URL(enrollment_url);
        if (url.protocol !== "https:") {
          return res.status(400).json(
            createResponse(false, undefined, {
              code: "INVALID_URL",
              message: "enrollment_url must use HTTPS protocol",
            }, requestId)
          );
        }
      } catch {
        return res.status(400).json(
          createResponse(false, undefined, {
            code: "INVALID_URL",
            message: "enrollment_url must be a valid URL",
          }, requestId)
        );
      }

      const client = supabaseService.getClient();

      const { data: program, error } = await client
        .from("programs")
        .update({ enrollment_url })
        .eq("id", programId)
        .select("id, name, enrollment_url")
        .single();

      if (error || !program) {
        return res.status(404).json(
          createResponse(false, undefined, {
            code: "PROGRAM_NOT_FOUND",
            message: error?.message || "Program not found or update failed",
          }, requestId)
        );
      }

      console.log(`✅ Program ${programId} enrollment URL updated: ${enrollment_url}`);

      return res.status(200).json(
        createResponse(true, {
          program,
          message: "Enrollment URL updated successfully",
        }, undefined, requestId)
      );
    } catch (error) {
      console.error("Update enrollment URL error:", error);
      return res.status(500).json(
        createResponse(false, undefined, {
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred",
        }, requestId)
      );
    }
  }

  async toggleSuspension(req: Request, res: Response, next: NextFunction) {
    const requestId = (req.headers["x-request-id"] as string) || generate();

    try {
      const { programId } = req.params;
      const { is_suspended } = req.body;

      if (!programId) {
        return res.status(400).json(
          createResponse(false, undefined, {
            code: "INVALID_REQUEST",
            message: "Program ID is required",
          }, requestId)
        );
      }

      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(programId);
      if (!isUuid) {
        return res.status(400).json(
          createResponse(false, undefined, {
            code: "INVALID_REQUEST",
            message: "programId must be a valid UUID format",
          }, requestId)
        );
      }

      if (typeof is_suspended !== "boolean") {
        return res.status(400).json(
          createResponse(false, undefined, {
            code: "INVALID_REQUEST",
            message: "is_suspended must be a boolean (true/false)",
          }, requestId)
        );
      }

      const client = supabaseService.getClient();

      const { data: program, error } = await client
        .from("programs")
        .update({ is_suspended })
        .eq("id", programId)
        .select("id, name, is_suspended")
        .single();

      if (error || !program) {
        return res.status(404).json(
          createResponse(false, undefined, {
            code: "PROGRAM_NOT_FOUND",
            message: error?.message || "Program not found or update failed",
          }, requestId)
        );
      }

      const action = is_suspended ? "SUSPENDED" : "ACTIVATED";
      console.log(`⚡ Program ${program.name} (${programId}) ${action}`);

      return res.status(200).json(
        createResponse(true, {
          program,
          action,
          message: is_suspended 
            ? "Program suspended. All POS transactions blocked."
            : "Program activated. POS transactions enabled.",
        }, undefined, requestId)
      );
    } catch (error) {
      console.error("Toggle suspension error:", error);
      return res.status(500).json(
        createResponse(false, undefined, {
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred",
        }, requestId)
      );
    }
  }

  async getStats(req: Request, res: Response, next: NextFunction) {
    const requestId = (req.headers["x-request-id"] as string) || generate();

    try {
      const { programId } = req.params;

      if (!programId) {
        return res.status(400).json(
          createResponse(false, undefined, {
            code: "INVALID_REQUEST",
            message: "Program ID is required",
          }, requestId)
        );
      }

      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(programId);
      if (!isUuid) {
        return res.status(400).json(
          createResponse(false, undefined, {
            code: "INVALID_REQUEST",
            message: "programId must be a valid UUID format",
          }, requestId)
        );
      }

      const client = supabaseService.getClient();

      const { data: program, error: programError } = await client
        .from("programs")
        .select("id, name, protocol, is_suspended, enrollment_url")
        .eq("id", programId)
        .single();

      if (programError || !program) {
        return res.status(404).json(
          createResponse(false, undefined, {
            code: "PROGRAM_NOT_FOUND",
            message: "Program not found",
          }, requestId)
        );
      }

      const { count: totalPasses } = await client
        .from("passes_master")
        .select("*", { count: "exact", head: true })
        .eq("program_id", programId);

      const { count: activePasses } = await client
        .from("passes_master")
        .select("*", { count: "exact", head: true })
        .eq("program_id", programId)
        .eq("is_active", true)
        .eq("status", "INSTALLED");

      const { count: qrEnrollments } = await client
        .from("passes_master")
        .select("*", { count: "exact", head: true })
        .eq("program_id", programId)
        .eq("enrollment_source", "QR_SCAN");

      const { count: claimEnrollments } = await client
        .from("passes_master")
        .select("*", { count: "exact", head: true })
        .eq("program_id", programId)
        .eq("enrollment_source", "CLAIM_CODE");

      const { count: churned } = await client
        .from("passes_master")
        .select("*", { count: "exact", head: true })
        .eq("program_id", programId)
        .in("status", ["UNINSTALLED", "INVALIDATED"]);

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { count: recentEnrollments } = await client
        .from("passes_master")
        .select("*", { count: "exact", head: true })
        .eq("program_id", programId)
        .gte("last_updated", thirtyDaysAgo.toISOString());

      const total = totalPasses || 0;
      const active = activePasses || 0;
      const activeRate = total > 0 ? Math.round((active / total) * 100) : 0;
      const churnRate = total > 0 ? Math.round(((churned || 0) / total) * 100) : 0;

      return res.status(200).json(
        createResponse(true, {
          program: {
            id: program.id,
            name: program.name,
            protocol: program.protocol,
            isSuspended: program.is_suspended,
            hasEnrollmentUrl: !!program.enrollment_url,
          },
          stats: {
            totalMembers: total,
            activeMembers: active,
            activeRate,
            churnedMembers: churned || 0,
            churnRate,
            recentEnrollments: recentEnrollments || 0,
          },
          enrollmentBreakdown: {
            qrScan: qrEnrollments || 0,
            claimCode: claimEnrollments || 0,
            qrPercentage: total > 0 ? Math.round(((qrEnrollments || 0) / total) * 100) : 0,
          },
        }, undefined, requestId)
      );
    } catch (error) {
      console.error("Get stats error:", error);
      return res.status(500).json(
        createResponse(false, undefined, {
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred",
        }, requestId)
      );
    }
  }
}

export const programsController = new ProgramsController();
