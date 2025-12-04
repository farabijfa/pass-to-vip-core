import type { Request, Response, NextFunction } from "express";
import { supabaseService } from "../services";
import { generate } from "short-uuid";

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
          birthday_message
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
}

export const programsController = new ProgramsController();
