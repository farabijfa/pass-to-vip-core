import type { Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { config, isSupabaseConfigured } from "../config";
import { passKitService } from "../services/passkit.service";
import { generate } from "short-uuid";

const enrollmentSchema = z.object({
  dashboardSlug: z.string().min(1, "Dashboard slug is required"),
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  email: z.string().email("Valid email is required"),
});

class PublicEnrollController {
  private getServiceClient() {
    return createClient(
      config.supabase.url,
      config.supabase.serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
  }

  async handlePublicEnrollment(req: Request, res: Response): Promise<void> {
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

      const validation = enrollmentSchema.safeParse(req.body);

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

      const { dashboardSlug, firstName, lastName, email } = validation.data;
      const normalizedEmail = email.toLowerCase().trim();

      const client = this.getServiceClient();

      const { data: program, error: programError } = await client
        .from("programs")
        .select(`
          id,
          name,
          passkit_program_id,
          passkit_tier_id,
          passkit_status,
          protocol,
          is_suspended,
          enrollment_url
        `)
        .eq("dashboard_slug", dashboardSlug)
        .single();

      if (programError || !program) {
        res.status(404).json({
          success: false,
          error: {
            code: "PROGRAM_NOT_FOUND",
            message: "Loyalty program not found",
          },
        });
        return;
      }

      if (program.is_suspended) {
        res.status(403).json({
          success: false,
          error: {
            code: "PROGRAM_SUSPENDED",
            message: "This loyalty program is currently suspended",
          },
        });
        return;
      }

      if (program.protocol !== "MEMBERSHIP") {
        res.status(400).json({
          success: false,
          error: {
            code: "UNSUPPORTED_PROTOCOL",
            message: "Public enrollment is only available for membership programs",
          },
        });
        return;
      }

      const { data: existingMember, error: lookupError } = await client
        .from("passes_master")
        .select("id, external_id, passkit_id, status")
        .eq("program_id", program.id)
        .eq("email", normalizedEmail)
        .single();

      if (existingMember && !lookupError) {
        console.log(`📧 Existing member found: ${existingMember.id}`);

        if (existingMember.passkit_id && program.passkit_tier_id) {
          const installUrl = `https://pub2.pskt.io/${existingMember.passkit_id}`;
          
          res.status(200).json({
            success: true,
            data: {
              memberId: existingMember.id,
              isNewMember: false,
              redirectUrl: installUrl,
              message: "Welcome back! Redirecting to your existing pass.",
            },
            metadata: { processingTime: Date.now() - startTime },
          });
          return;
        }

        if (program.enrollment_url) {
          res.status(200).json({
            success: true,
            data: {
              memberId: existingMember.id,
              isNewMember: false,
              redirectUrl: program.enrollment_url,
              message: "Welcome back! Redirecting to enrollment page.",
            },
            metadata: { processingTime: Date.now() - startTime },
          });
          return;
        }
      }

      const memberId = generate();
      const externalId = `PUB-${memberId}`;

      const { error: insertError } = await client
        .from("passes_master")
        .insert({
          id: memberId,
          program_id: program.id,
          external_id: externalId,
          first_name: firstName,
          last_name: lastName,
          email: normalizedEmail,
          points_balance: 0,
          status: "ACTIVE",
          source: "PUBLIC_FORM",
          created_at: new Date().toISOString(),
        });

      if (insertError) {
        console.error("❌ Failed to insert member:", insertError);
        res.status(500).json({
          success: false,
          error: {
            code: "INSERT_FAILED",
            message: "Failed to create membership",
          },
        });
        return;
      }

      console.log(`✅ New member created: ${memberId} (${externalId})`);

      let redirectUrl = program.enrollment_url || `https://pub2.pskt.io/c/${program.passkit_tier_id}`;
      let passkitId: string | null = null;

      if (program.passkit_program_id && program.passkit_status === "provisioned") {
        try {
          const enrollResult = await passKitService.enrollMember(
            program.passkit_program_id,
            {
              email: normalizedEmail,
              firstName,
              lastName,
              points: 0,
              tierId: program.passkit_tier_id || undefined,
            }
          );

          if (enrollResult.success && enrollResult.passkit_internal_id) {
            passkitId = enrollResult.passkit_internal_id;
            
            await client
              .from("passes_master")
              .update({ passkit_id: passkitId })
              .eq("id", memberId);

            if (enrollResult.install_url) {
              redirectUrl = enrollResult.install_url;
            }

            console.log(`🎫 PassKit enrollment complete: ${passkitId}`);
          } else {
            console.warn("⚠️ PassKit enrollment failed, using fallback URL:", enrollResult.error);
          }
        } catch (passkitError) {
          console.error("❌ PassKit API error:", passkitError);
        }
      } else {
        console.log("⏭️ PassKit not provisioned, using generic enrollment URL");
      }

      res.status(201).json({
        success: true,
        data: {
          memberId,
          externalId,
          isNewMember: true,
          redirectUrl,
          passkitId,
          message: "Welcome to the VIP club! Redirecting to download your pass.",
        },
        metadata: { processingTime: Date.now() - startTime },
      });

    } catch (error) {
      console.error("Public enrollment error:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Unknown error occurred",
        },
      });
    }
  }

  async getProgramInfo(req: Request, res: Response): Promise<void> {
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

      const { slug } = req.params;

      if (!slug) {
        res.status(400).json({
          success: false,
          error: {
            code: "MISSING_SLUG",
            message: "Dashboard slug is required",
          },
        });
        return;
      }

      const client = this.getServiceClient();

      const { data: program, error } = await client
        .from("programs")
        .select(`
          id,
          name,
          protocol,
          is_suspended,
          enrollment_url,
          passkit_status
        `)
        .eq("dashboard_slug", slug)
        .single();

      if (error || !program) {
        res.status(404).json({
          success: false,
          error: {
            code: "PROGRAM_NOT_FOUND",
            message: "Loyalty program not found",
          },
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          programName: program.name,
          protocol: program.protocol,
          isSuspended: program.is_suspended,
          isPassKitReady: program.passkit_status === "provisioned",
          enrollmentEnabled: !program.is_suspended && program.protocol === "MEMBERSHIP",
        },
      });

    } catch (error) {
      console.error("Get program info error:", error);
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

export const publicEnrollController = new PublicEnrollController();
