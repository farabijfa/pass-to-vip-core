import type { Request, Response, NextFunction } from "express";
import { campaignService } from "../services/campaign.service";
import { postGridService } from "../services/postgrid.service";
import { supabaseService } from "../services/supabase.service";
import { generate } from "short-uuid";

interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

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

export class CampaignController {
  async previewCsv(req: MulterRequest, res: Response, next: NextFunction) {
    const requestId = (req.headers["x-request-id"] as string) || generate();

    try {
      if (!req.file) {
        return res.status(400).json(
          createResponse(
            false,
            undefined,
            {
              code: "NO_FILE",
              message: "No CSV file uploaded",
            },
            requestId
          )
        );
      }

      console.log(`📂 CSV preview request: ${req.file.originalname}`);

      const result = await campaignService.previewCsv(req.file.path);

      return res.status(200).json(
        createResponse(
          true,
          {
            preview: result,
            filename: req.file.originalname,
          },
          undefined,
          requestId
        )
      );
    } catch (error) {
      console.error("Campaign preview error:", error);
      return res.status(500).json(
        createResponse(
          false,
          undefined,
          {
            code: "INTERNAL_ERROR",
            message:
              error instanceof Error ? error.message : "Failed to preview CSV",
          },
          requestId
        )
      );
    }
  }

  async uploadCsv(req: MulterRequest, res: Response, next: NextFunction) {
    const requestId = (req.headers["x-request-id"] as string) || generate();
    const startTime = Date.now();

    try {
      if (!req.file) {
        return res.status(400).json(
          createResponse(
            false,
            undefined,
            {
              code: "NO_FILE",
              message: "No CSV file uploaded",
            },
            requestId
          )
        );
      }

      const { 
        program_id, 
        template_id,
        front_template_id, 
        back_template_id, 
        resource_type,
        size, 
        base_claim_url,
        description 
      } = req.body;

      const resourceType = resource_type === "letter" ? "letter" : "postcard";

      if (!program_id) {
        return res.status(400).json(
          createResponse(
            false,
            undefined,
            {
              code: "MISSING_PROGRAM_ID",
              message: "Program ID is required",
            },
            requestId
          )
        );
      }

      const programResult = await supabaseService.getProgramById(program_id);
      if (!programResult.success || !programResult.program) {
        return res.status(400).json(
          createResponse(
            false,
            undefined,
            {
              code: "PROGRAM_NOT_FOUND",
              message: "Program not found",
            },
            requestId
          )
        );
      }

      const passkitProgramId = programResult.program.passkit_program_id;

      if (resourceType === "letter") {
        const letterTemplateId = template_id || front_template_id;
        if (!letterTemplateId) {
          return res.status(400).json(
            createResponse(
              false,
              undefined,
              {
                code: "MISSING_TEMPLATE_ID",
                message: "Template ID is required for letters",
              },
              requestId
            )
          );
        }

        console.log(`📂 CSV upload received: ${req.file.originalname}`);
        console.log(`   Resource Type: Letter`);
        console.log(`   Program ID: ${program_id}`);
        console.log(`   Template: ${letterTemplateId}`);

        const result = await campaignService.processBatchUpload({
          filePath: req.file.path,
          programId: program_id,
          passkitProgramId: passkitProgramId,
          templateId: letterTemplateId,
          resourceType: "letter",
          baseClaimUrl: base_claim_url,
          description,
        });

        const processingTime = Date.now() - startTime;
        const statusCode = result.failed === result.total ? 400 : 201;

        return res.status(statusCode).json({
          success: result.success > 0,
          data: {
            summary: {
              total: result.total,
              success: result.success,
              failed: result.failed,
              resourceType: "letter",
            },
            results: result.results,
          },
          metadata: {
            requestId,
            timestamp: new Date().toISOString(),
            processingTime,
          },
        });
      }

      if (!front_template_id && !template_id) {
        return res.status(400).json(
          createResponse(
            false,
            undefined,
            {
              code: "MISSING_TEMPLATE_ID",
              message: "Front Template ID is required for postcards",
            },
            requestId
          )
        );
      }

      const postcardFrontTemplate = front_template_id || template_id;

      console.log(`📂 CSV upload received: ${req.file.originalname}`);
      console.log(`   Resource Type: Postcard`);
      console.log(`   Program ID: ${program_id}`);
      console.log(`   Front Template: ${postcardFrontTemplate}`);
      console.log(`   Back Template: ${back_template_id || postcardFrontTemplate}`);
      console.log(`   Size: ${size || "6x4"}`);

      const result = await campaignService.processBatchUpload({
        filePath: req.file.path,
        programId: program_id,
        passkitProgramId: passkitProgramId,
        templateId: postcardFrontTemplate,
        frontTemplateId: postcardFrontTemplate,
        backTemplateId: back_template_id,
        resourceType: "postcard",
        size: size || "6x4",
        baseClaimUrl: base_claim_url,
      });

      const processingTime = Date.now() - startTime;
      const statusCode = result.failed === result.total ? 400 : 201;

      return res.status(statusCode).json({
        success: result.success > 0,
        data: {
          summary: {
            total: result.total,
            success: result.success,
            failed: result.failed,
            resourceType: "postcard",
          },
          results: result.results,
        },
        metadata: {
          requestId,
          timestamp: new Date().toISOString(),
          processingTime,
        },
      });
    } catch (error) {
      console.error("Campaign upload error:", error);
      return res.status(500).json(
        createResponse(
          false,
          undefined,
          {
            code: "INTERNAL_ERROR",
            message:
              error instanceof Error ? error.message : "Failed to process campaign",
          },
          requestId
        )
      );
    }
  }

  async getTemplates(req: Request, res: Response, _next: NextFunction) {
    const requestId = (req.headers["x-request-id"] as string) || generate();

    try {
      const result = await postGridService.listTemplates();

      if (result.error) {
        return res.status(500).json(
          createResponse(
            false,
            undefined,
            {
              code: "POSTGRID_ERROR",
              message: result.error,
            },
            requestId
          )
        );
      }

      const templates = result.templates.map((t: any) => ({
        id: t.id,
        name: t.description || t.id,
        description: t.description,
        type: t.object === "letter_template" ? "letter" : "postcard",
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      }));

      return res.status(200).json(
        createResponse(
          true,
          { templates },
          undefined,
          requestId
        )
      );
    } catch (error) {
      console.error("Get templates error:", error);
      return res.status(500).json(
        createResponse(
          false,
          undefined,
          {
            code: "INTERNAL_ERROR",
            message: error instanceof Error ? error.message : "Failed to fetch templates",
          },
          requestId
        )
      );
    }
  }

  async validateClient(req: Request, res: Response, _next: NextFunction) {
    const requestId = (req.headers["x-request-id"] as string) || generate();

    try {
      const { clientId } = req.body;

      if (!clientId) {
        return res.status(400).json(
          createResponse(
            false,
            undefined,
            {
              code: "MISSING_CLIENT_ID",
              message: "Client ID is required",
            },
            requestId
          )
        );
      }

      const result = await supabaseService.validateClientById(clientId);

      if (!result.success || !result.client) {
        return res.status(404).json(
          createResponse(
            false,
            undefined,
            {
              code: "CLIENT_NOT_FOUND",
              message: result.error || "Client not found",
            },
            requestId
          )
        );
      }

      return res.status(200).json(
        createResponse(
          true,
          {
            client: result.client,
            valid: true,
          },
          undefined,
          requestId
        )
      );
    } catch (error) {
      console.error("Validate client error:", error);
      return res.status(500).json(
        createResponse(
          false,
          undefined,
          {
            code: "INTERNAL_ERROR",
            message: error instanceof Error ? error.message : "Failed to validate client",
          },
          requestId
        )
      );
    }
  }

  async estimateCost(req: Request, res: Response, _next: NextFunction) {
    const requestId = (req.headers["x-request-id"] as string) || generate();

    try {
      const { contact_count, resource_type, size, mailing_class, program_id } = req.body;

      if (!contact_count || contact_count < 1) {
        return res.status(400).json(
          createResponse(
            false,
            undefined,
            {
              code: "INVALID_CONTACT_COUNT",
              message: "Contact count must be at least 1",
            },
            requestId
          )
        );
      }

      const pricing = getCampaignPricing(resource_type, size, mailing_class);
      const totalCostCents = pricing.unitCostCents * contact_count;

      // Gap M: Fetch program budget if program_id provided
      let budgetInfo: {
        programBudgetCents: number;
        budgetUtilization: number;
        isOverBudget: boolean;
        isNearBudget: boolean;
        requiresConfirmation: boolean;
      } | undefined;

      if (program_id) {
        const programResult = await supabaseService.getProgramById(program_id);
        if (programResult.success && programResult.program) {
          // Guard against zero/negative budgets to avoid NaN
          const programBudgetCents = Math.max(programResult.program.campaign_budget_cents ?? 50000, 1);
          const budgetUtilization = Math.round((totalCostCents / programBudgetCents) * 100);
          const isOverBudget = totalCostCents > programBudgetCents;
          const isNearBudget = !isOverBudget && budgetUtilization >= 80;

          budgetInfo = {
            programBudgetCents,
            budgetUtilization,
            isOverBudget,
            isNearBudget,
            requiresConfirmation: isOverBudget,
          };
        }
      }

      return res.status(200).json(
        createResponse(
          true,
          {
            contactCount: contact_count,
            resourceType: resource_type,
            size,
            mailingClass: mailing_class,
            unitCostCents: pricing.unitCostCents,
            totalCostCents,
            breakdown: pricing.breakdown,
            ...(budgetInfo && { budget: budgetInfo }),
          },
          undefined,
          requestId
        )
      );
    } catch (error) {
      console.error("Estimate cost error:", error);
      return res.status(500).json(
        createResponse(
          false,
          undefined,
          {
            code: "INTERNAL_ERROR",
            message: error instanceof Error ? error.message : "Failed to estimate cost",
          },
          requestId
        )
      );
    }
  }

  async getCampaignHistory(req: Request, res: Response, _next: NextFunction) {
    const requestId = (req.headers["x-request-id"] as string) || generate();

    try {
      const { program_id, limit = 20, offset = 0 } = req.query;

      const result = await supabaseService.getCampaignHistory(
        program_id as string | undefined,
        Number(limit),
        Number(offset)
      );

      if (!result.success) {
        return res.status(500).json(
          createResponse(
            false,
            undefined,
            {
              code: "FETCH_ERROR",
              message: result.error || "Failed to fetch campaign history",
            },
            requestId
          )
        );
      }

      return res.status(200).json(
        createResponse(
          true,
          {
            campaigns: result.campaigns,
            total: result.total,
          },
          undefined,
          requestId
        )
      );
    } catch (error) {
      console.error("Get campaign history error:", error);
      return res.status(500).json(
        createResponse(
          false,
          undefined,
          {
            code: "INTERNAL_ERROR",
            message: error instanceof Error ? error.message : "Failed to fetch campaign history",
          },
          requestId
        )
      );
    }
  }

  async getCampaignDetails(req: Request, res: Response, _next: NextFunction) {
    const requestId = (req.headers["x-request-id"] as string) || generate();

    try {
      const { campaignId } = req.params;

      if (!campaignId) {
        return res.status(400).json(
          createResponse(
            false,
            undefined,
            {
              code: "MISSING_CAMPAIGN_ID",
              message: "Campaign ID is required",
            },
            requestId
          )
        );
      }

      const result = await supabaseService.getCampaignDetails(campaignId);

      if (!result.success) {
        return res.status(404).json(
          createResponse(
            false,
            undefined,
            {
              code: "CAMPAIGN_NOT_FOUND",
              message: result.error || "Campaign not found",
            },
            requestId
          )
        );
      }

      return res.status(200).json(
        createResponse(
          true,
          {
            campaign: result.campaign,
            contacts: result.contacts,
          },
          undefined,
          requestId
        )
      );
    } catch (error) {
      console.error("Get campaign details error:", error);
      return res.status(500).json(
        createResponse(
          false,
          undefined,
          {
            code: "INTERNAL_ERROR",
            message: error instanceof Error ? error.message : "Failed to fetch campaign details",
          },
          requestId
        )
      );
    }
  }
}

export function getCampaignPricing(
  resourceType: string,
  size: string,
  mailingClass: string
): { unitCostCents: number; breakdown: { printing: number; postage: number; processing: number } } {
  const pricing: Record<string, Record<string, { printing: number; postage: number; processing: number }>> = {
    postcard: {
      "4x6": { printing: 15, postage: 35, processing: 5 },
      "6x4": { printing: 15, postage: 35, processing: 5 },
      "6x9": { printing: 25, postage: 45, processing: 5 },
      "9x6": { printing: 25, postage: 45, processing: 5 },
      "6x11": { printing: 35, postage: 55, processing: 5 },
      "11x6": { printing: 35, postage: 55, processing: 5 },
    },
    letter: {
      "us_letter": { printing: 50, postage: 60, processing: 10 },
      "us_legal": { printing: 55, postage: 65, processing: 10 },
      "a4": { printing: 50, postage: 60, processing: 10 },
    },
  };

  const mailingClassMultiplier = mailingClass === "first_class" ? 1.5 : 1.0;

  const basePricing = pricing[resourceType]?.[size] || { printing: 50, postage: 50, processing: 10 };
  const adjustedPostage = Math.round(basePricing.postage * mailingClassMultiplier);

  return {
    unitCostCents: basePricing.printing + adjustedPostage + basePricing.processing,
    breakdown: {
      printing: basePricing.printing,
      postage: adjustedPostage,
      processing: basePricing.processing,
    },
  };
}

export const campaignController = new CampaignController();
