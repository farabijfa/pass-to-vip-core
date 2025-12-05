import type { Request, Response } from "express";
import { notificationService } from "../services/notification.service";
import { z } from "zod";

const segmentSchema = z.enum(["ALL", "VIP", "DORMANT", "GEO", "CSV"]);

const segmentConfigSchema = z.object({
  vipThreshold: z.number().min(0).optional(),
  dormantDays: z.number().min(1).max(365).optional(),
  zipCodes: z.array(z.string()).optional(),
  memberIds: z.array(z.string()).optional(),
});

const broadcastSchema = z.object({
  programId: z.string().min(1, "Program ID is required"),
  message: z.string().min(5, "Message too short (minimum 5 characters)").max(500, "Message too long"),
  segment: segmentSchema.optional(),
  segmentConfig: segmentConfigSchema.optional(),
  campaignName: z.string().optional(),
});

const broadcastTestSchema = z.object({
  programId: z.string().min(1, "Program ID is required"),
  message: z.string().min(5, "Message too short (minimum 5 characters)").max(500, "Message too long"),
  segment: segmentSchema.optional(),
  segmentConfig: segmentConfigSchema.optional(),
});

const csvBroadcastSchema = z.object({
  programId: z.string().min(1, "Program ID is required"),
  message: z.string().min(5, "Message too short (minimum 5 characters)").max(500, "Message too long"),
  memberIds: z.array(z.string()).min(1, "At least one member ID required"),
  campaignName: z.string().optional(),
});

const segmentPreviewSchema = z.object({
  programId: z.string().min(1, "Program ID is required"),
  segment: segmentSchema,
  segmentConfig: segmentConfigSchema.optional(),
});

class NotificationController {
  async sendBroadcast(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();

    try {
      const validation = broadcastSchema.safeParse(req.body);

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

      const { programId, message, segment, segmentConfig, campaignName } = validation.data;

      console.log(`📢 Broadcast request received for program: ${programId}`);

      const result = await notificationService.sendBroadcast({
        programId,
        message,
        segment,
        segmentConfig,
        campaignName,
        dryRun: false,
      });

      const processingTime = Date.now() - startTime;

      if (!result.success) {
        res.status(500).json({
          success: false,
          error: {
            code: "BROADCAST_FAILED",
            message: result.error,
          },
          metadata: { processingTime },
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          totalRecipients: result.totalRecipients,
          successCount: result.successCount,
          failedCount: result.failedCount,
          campaignLogId: result.campaignLogId,
          segment: result.targetSegment,
          segmentDescription: result.segmentDescription,
        },
        metadata: { processingTime },
      });
    } catch (error) {
      console.error("Broadcast controller error:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Unknown error",
        },
      });
    }
  }

  async sendCsvBroadcast(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();

    try {
      const validation = csvBroadcastSchema.safeParse(req.body);

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

      const { programId, message, memberIds, campaignName } = validation.data;

      console.log(`📢 CSV Broadcast request for ${memberIds.length} members in program: ${programId}`);

      const result = await notificationService.sendToMemberIds(
        programId,
        memberIds,
        message,
        campaignName,
        false
      );

      const processingTime = Date.now() - startTime;

      if (!result.success) {
        res.status(500).json({
          success: false,
          error: {
            code: "CSV_BROADCAST_FAILED",
            message: result.error,
          },
          metadata: { processingTime },
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          totalRecipients: result.totalRecipients,
          successCount: result.successCount,
          failedCount: result.failedCount,
          campaignLogId: result.campaignLogId,
          targetedCount: memberIds.length,
          matchedCount: result.totalRecipients,
        },
        metadata: { processingTime },
      });
    } catch (error) {
      console.error("CSV Broadcast controller error:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Unknown error",
        },
      });
    }
  }

  async runBirthdayBot(_req: Request, res: Response): Promise<void> {
    const startTime = Date.now();

    try {
      console.log("🎂 Birthday Bot triggered via API");

      const result = await notificationService.runBirthdayBot();

      const processingTime = Date.now() - startTime;

      if (!result.success) {
        res.status(500).json({
          success: false,
          error: {
            code: "BIRTHDAY_BOT_FAILED",
            message: result.error,
          },
          metadata: { processingTime },
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          programsProcessed: result.programsProcessed,
          processed: result.processed,
          successCount: result.successCount,
          failedCount: result.failedCount,
          alreadyGifted: result.alreadyGifted,
          campaignLogId: result.campaignLogId,
        },
        metadata: { processingTime },
      });
    } catch (error) {
      console.error("Birthday Bot controller error:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Unknown error",
        },
      });
    }
  }

  async testBroadcast(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();

    try {
      const validation = broadcastTestSchema.safeParse(req.body);

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

      const { programId, message, segment, segmentConfig } = validation.data;

      console.log(`🧪 Broadcast TEST (Dry Run) for program: ${programId}`);

      const result = await notificationService.sendBroadcast({
        programId,
        message,
        segment,
        segmentConfig,
        dryRun: true,
      });

      const processingTime = Date.now() - startTime;

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: {
            code: "BROADCAST_TEST_FAILED",
            message: result.error,
          },
          metadata: { processingTime, dryRun: true },
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Dry run completed - no messages were sent",
        data: {
          totalRecipients: result.totalRecipients,
          messagePreview: result.messagePreview,
          targetSegment: result.targetSegment,
          segmentDescription: result.segmentDescription,
          sampleRecipients: result.sampleRecipients,
        },
        metadata: { processingTime, dryRun: true },
      });
    } catch (error) {
      console.error("Broadcast test error:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Unknown error",
        },
      });
    }
  }

  async testBirthdayBot(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();

    try {
      const { testDate } = req.query;

      console.log("🧪 Birthday Bot TEST (Dry Run) triggered via API");

      let validatedTestDate: string | undefined;
      if (testDate) {
        const parsed = new Date(testDate as string);
        if (isNaN(parsed.getTime())) {
          res.status(400).json({
            success: false,
            error: {
              code: "INVALID_DATE",
              message: "Invalid testDate format. Use YYYY-MM-DD format.",
            },
          });
          return;
        }
        validatedTestDate = testDate as string;
        console.log(`   Using test date: ${validatedTestDate}`);
      }

      const result = await notificationService.runBirthdayBot({
        dryRun: true,
        testDate: validatedTestDate,
      });

      const processingTime = Date.now() - startTime;

      res.status(200).json({
        success: true,
        message: "Dry run completed - no actual changes were made",
        data: {
          programsProcessed: result.programsProcessed,
          processed: result.processed,
          successCount: result.successCount,
          failedCount: result.failedCount,
          alreadyGifted: result.alreadyGifted,
          details: result.details,
        },
        metadata: {
          processingTime,
          dryRun: true,
          testDate: testDate || new Date().toISOString().split("T")[0],
        },
      });
    } catch (error) {
      console.error("Birthday Bot test error:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Unknown error",
        },
      });
    }
  }

  async getCampaignLogs(req: Request, res: Response): Promise<void> {
    try {
      const { programId, limit } = req.query;

      const result = await notificationService.getCampaignLogs(
        programId as string | undefined,
        limit ? parseInt(limit as string, 10) : 50
      );

      if (!result.success) {
        res.status(500).json({
          success: false,
          error: {
            code: "FETCH_LOGS_FAILED",
            message: result.error,
          },
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          logs: result.logs,
          count: result.logs?.length || 0,
        },
      });
    } catch (error) {
      console.error("Get campaign logs error:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Unknown error",
        },
      });
    }
  }

  async getSegmentPreview(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();

    try {
      const validation = segmentPreviewSchema.safeParse(req.body);

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

      const { programId, segment, segmentConfig } = validation.data;

      const result = await notificationService.getSegmentPreview(programId, segment, segmentConfig);
      const processingTime = Date.now() - startTime;

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: {
            code: "SEGMENT_PREVIEW_FAILED",
            message: result.error,
          },
          metadata: { processingTime },
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result.stats,
        metadata: { processingTime },
      });
    } catch (error) {
      console.error("Segment preview error:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Unknown error",
        },
      });
    }
  }

  async getAvailableSegments(req: Request, res: Response): Promise<void> {
    try {
      const { programId } = req.query;

      if (!programId || typeof programId !== "string") {
        res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "programId query parameter is required",
          },
        });
        return;
      }

      const result = await notificationService.getAvailableSegments(programId);

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: {
            code: "FETCH_SEGMENTS_FAILED",
            message: result.error,
          },
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          segments: result.segments,
        },
      });
    } catch (error) {
      console.error("Get available segments error:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Unknown error",
        },
      });
    }
  }
}

export const notificationController = new NotificationController();
