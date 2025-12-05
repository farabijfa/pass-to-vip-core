import type { Request, Response, NextFunction } from "express";
import { campaignService } from "../services/campaign.service";
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
}

export const campaignController = new CampaignController();
