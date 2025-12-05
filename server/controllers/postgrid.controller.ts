import type { Request, Response, NextFunction } from "express";
import { postGridService, supabaseService } from "../services";
import type { PostGridMail, ApiResponse, BatchCampaignRequest, BatchCampaignContact } from "@shared/schema";
import { generate } from "short-uuid";
import { getCampaignPricing } from "./campaign.controller";

function createResponse<T>(
  success: boolean,
  data?: T,
  error?: { code: string; message: string; details?: any },
  requestId?: string
): ApiResponse<T> {
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

export class PostGridController {
  async sendDirectMail(req: Request, res: Response, next: NextFunction) {
    const requestId = (req.headers["x-request-id"] as string) || generate();
    const startTime = Date.now();

    try {
      const mailData: PostGridMail = req.body;

      const result = await postGridService.sendDirectMail(mailData);

      if (!result.success) {
        return res.status(400).json(
          createResponse(
            false,
            undefined,
            {
              code: "MAIL_SEND_FAILED",
              message: result.error || "Failed to send direct mail",
            },
            requestId
          )
        );
      }

      const response = createResponse(
        true,
        {
          mailId: result.mailId,
          status: result.status,
          estimatedDeliveryDate: result.estimatedDeliveryDate,
          memberId: mailData.memberId,
          templateId: mailData.templateId,
          createdAt: new Date().toISOString(),
        },
        undefined,
        requestId
      );

      response.metadata!.processingTime = Date.now() - startTime;

      return res.status(201).json(response);
    } catch (error) {
      console.error("Send direct mail error:", error);
      return res.status(500).json(
        createResponse(
          false,
          undefined,
          {
            code: "INTERNAL_ERROR",
            message: "An unexpected error occurred while sending direct mail",
          },
          requestId
        )
      );
    }
  }

  async getMailStatus(req: Request, res: Response, next: NextFunction) {
    const requestId = (req.headers["x-request-id"] as string) || generate();

    try {
      const { mailId } = req.params;

      if (!mailId) {
        return res.status(400).json(
          createResponse(
            false,
            undefined,
            {
              code: "INVALID_REQUEST",
              message: "Mail ID is required",
            },
            requestId
          )
        );
      }

      const result = await postGridService.getMailStatus(mailId);

      if (!result.success) {
        return res.status(404).json(
          createResponse(
            false,
            undefined,
            {
              code: "MAIL_NOT_FOUND",
              message: result.error || "Mail not found",
            },
            requestId
          )
        );
      }

      return res.status(200).json(
        createResponse(
          true,
          {
            mailId: result.mailId,
            status: result.status,
            estimatedDeliveryDate: result.estimatedDeliveryDate,
          },
          undefined,
          requestId
        )
      );
    } catch (error) {
      console.error("Get mail status error:", error);
      return res.status(500).json(
        createResponse(
          false,
          undefined,
          {
            code: "INTERNAL_ERROR",
            message: "An unexpected error occurred while retrieving mail status",
          },
          requestId
        )
      );
    }
  }

  async cancelMail(req: Request, res: Response, next: NextFunction) {
    const requestId = (req.headers["x-request-id"] as string) || generate();

    try {
      const { mailId } = req.params;

      if (!mailId) {
        return res.status(400).json(
          createResponse(
            false,
            undefined,
            {
              code: "INVALID_REQUEST",
              message: "Mail ID is required",
            },
            requestId
          )
        );
      }

      const result = await postGridService.cancelMail(mailId);

      if (!result.success) {
        return res.status(400).json(
          createResponse(
            false,
            undefined,
            {
              code: "MAIL_CANCEL_FAILED",
              message: result.error || "Failed to cancel mail",
            },
            requestId
          )
        );
      }

      return res.status(200).json(
        createResponse(
          true,
          {
            mailId,
            cancelled: true,
            cancelledAt: new Date().toISOString(),
          },
          undefined,
          requestId
        )
      );
    } catch (error) {
      console.error("Cancel mail error:", error);
      return res.status(500).json(
        createResponse(
          false,
          undefined,
          {
            code: "INTERNAL_ERROR",
            message: "An unexpected error occurred while cancelling mail",
          },
          requestId
        )
      );
    }
  }

  async listTemplates(req: Request, res: Response, next: NextFunction) {
    const requestId = (req.headers["x-request-id"] as string) || generate();

    try {
      const result = await postGridService.listTemplates();

      if (result.error) {
        return res.status(400).json(
          createResponse(
            false,
            undefined,
            {
              code: "TEMPLATES_FETCH_FAILED",
              message: result.error,
            },
            requestId
          )
        );
      }

      return res.status(200).json(
        createResponse(
          true,
          {
            templates: result.templates,
            count: result.templates.length,
          },
          undefined,
          requestId
        )
      );
    } catch (error) {
      console.error("List templates error:", error);
      return res.status(500).json(
        createResponse(
          false,
          undefined,
          {
            code: "INTERNAL_ERROR",
            message: "An unexpected error occurred while listing templates",
          },
          requestId
        )
      );
    }
  }

  async sendBatchCampaign(req: Request, res: Response, next: NextFunction) {
    const requestId = (req.headers["x-request-id"] as string) || generate();
    const startTime = Date.now();

    try {
      const campaignData: BatchCampaignRequest = req.body;
      const { templateId, frontTemplateId, backTemplateId, size, programId, contacts, baseClaimUrl, resourceType, mailingClass, highCostConfirmation } = campaignData;

      const claimBaseUrl = baseClaimUrl || `${req.protocol}://${req.get('host')}/claim`;

      console.log(`📬 Starting batch campaign: ${contacts.length} contacts, program: ${programId}`);

      // === GAP M: BUDGET SAFETY VALIDATION ===
      // Fetch program budget from database - programId can be UUID or passkit_program_id
      const programResult = await supabaseService.getProgramById(programId);
      let program = programResult.success ? programResult.program : null;
      
      // Fallback: try by passkit_program_id if UUID lookup fails
      if (!program) {
        const passkitResult = await supabaseService.getProgramByPasskitId(programId);
        if (passkitResult.success && passkitResult.program) {
          // Re-fetch with getProgramById to get campaign_budget_cents
          const fullProgram = await supabaseService.getProgramById(passkitResult.program.id);
          program = fullProgram.success ? fullProgram.program : null;
        }
      }

      if (!program) {
        console.warn(`⚠️ Could not fetch program budget for ${programId}, using default limit`);
      }

      const budgetCents = Math.max(program?.campaign_budget_cents ?? 50000, 1); // Default $500, min 1 cent

      // Calculate estimated cost
      const pricing = getCampaignPricing(resourceType || "postcard", size || "6x9", mailingClass || "standard");
      const estimatedCostCents = pricing.unitCostCents * contacts.length;

      console.log(`💰 Budget check: Estimated $${(estimatedCostCents / 100).toFixed(2)} vs Budget $${(budgetCents / 100).toFixed(2)}`);

      // Check if over budget
      if (estimatedCostCents > budgetCents) {
        // Require explicit confirmation for over-budget campaigns
        if (!highCostConfirmation || highCostConfirmation !== "CONFIRM CHARGE") {
          return res.status(400).json(
            createResponse(
              false,
              {
                budgetExceeded: true,
                estimatedCostCents,
                budgetCents,
                estimatedCostDollars: (estimatedCostCents / 100).toFixed(2),
                budgetDollars: (budgetCents / 100).toFixed(2),
                overagePercent: Math.round((estimatedCostCents / budgetCents - 1) * 100),
              },
              {
                code: "BUDGET_EXCEEDED",
                message: `Campaign cost ($${(estimatedCostCents / 100).toFixed(2)}) exceeds budget ($${(budgetCents / 100).toFixed(2)}). Type 'CONFIRM CHARGE' to proceed.`,
              },
              requestId
            )
          );
        }
        console.log(`✅ Over-budget campaign confirmed: $${(estimatedCostCents / 100).toFixed(2)}`);
      }

      const results: Array<{
        contact: string;
        success: boolean;
        claimCode?: string;
        postcardId?: string;
        error?: string;
      }> = [];

      let successCount = 0;
      let failureCount = 0;

      for (const contact of contacts) {
        const contactName = contact.lastName 
          ? `${contact.firstName} ${contact.lastName}`
          : contact.firstName;

        try {
          const claimResult = await supabaseService.generateClaimCode({
            passkitProgramId: programId,
            contact,
          });

          if (!claimResult.success || !claimResult.claimCode) {
            failureCount++;
            results.push({
              contact: contactName,
              success: false,
              error: claimResult.error || "Failed to generate claim code",
            });
            continue;
          }

          const claimUrl = `${claimBaseUrl}/${claimResult.claimCode}`;

          const postcardResult = await postGridService.sendPostcard({
            templateId,
            frontTemplateId,
            backTemplateId,
            size: size || "6x9",
            recipientAddress: {
              firstName: contact.firstName,
              lastName: contact.lastName,
              addressLine1: contact.addressLine1,
              addressLine2: contact.addressLine2,
              city: contact.city,
              state: contact.state,
              postalCode: contact.postalCode,
              country: contact.country || 'US',
            },
            claimCode: claimResult.claimCode,
            claimUrl,
          });

          if (!postcardResult.success) {
            failureCount++;
            results.push({
              contact: contactName,
              success: false,
              claimCode: claimResult.claimCode,
              error: postcardResult.error || "Failed to send postcard",
            });
            continue;
          }

          successCount++;
          results.push({
            contact: contactName,
            success: true,
            claimCode: claimResult.claimCode,
            postcardId: postcardResult.postcardId,
          });

        } catch (err) {
          failureCount++;
          results.push({
            contact: contactName,
            success: false,
            error: err instanceof Error ? err.message : "Unexpected error",
          });
        }
      }

      const response = createResponse(
        successCount > 0,
        {
          campaignSummary: {
            totalContacts: contacts.length,
            successCount,
            failureCount,
            frontTemplateId: frontTemplateId || templateId,
            backTemplateId: backTemplateId || templateId,
            programId,
          },
          results,
        },
        failureCount === contacts.length ? {
          code: "CAMPAIGN_FAILED",
          message: "All postcards failed to send",
        } : undefined,
        requestId
      );

      response.metadata!.processingTime = Date.now() - startTime;

      console.log(`📮 Batch campaign complete: ${successCount}/${contacts.length} sent`);

      return res.status(successCount > 0 ? 201 : 400).json(response);
    } catch (error) {
      console.error("Batch campaign error:", error);
      return res.status(500).json(
        createResponse(
          false,
          undefined,
          {
            code: "INTERNAL_ERROR",
            message: "An unexpected error occurred while processing batch campaign",
          },
          requestId
        )
      );
    }
  }
}

export const postGridController = new PostGridController();
