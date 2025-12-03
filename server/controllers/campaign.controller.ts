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

      const { program_id, front_template_id, back_template_id, size, base_claim_url } =
        req.body;

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

      if (!front_template_id) {
        return res.status(400).json(
          createResponse(
            false,
            undefined,
            {
              code: "MISSING_TEMPLATE_ID",
              message: "Front Template ID is required",
            },
            requestId
          )
        );
      }

      console.log(`📂 CSV upload received: ${req.file.originalname}`);
      console.log(`   Program ID: ${program_id}`);
      console.log(`   Front Template: ${front_template_id}`);
      console.log(`   Back Template: ${back_template_id || front_template_id}`);
      console.log(`   Size: ${size || "6x4"}`);

      const result = await campaignService.processBatchUpload({
        filePath: req.file.path,
        programId: program_id,
        frontTemplateId: front_template_id,
        backTemplateId: back_template_id,
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
