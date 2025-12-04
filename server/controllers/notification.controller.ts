import type { Request, Response } from "express";
import { notificationService } from "../services/notification.service";
import { z } from "zod";

const broadcastSchema = z.object({
  programId: z.string().min(1, "Program ID is required"),
  message: z.string().min(1, "Message is required").max(500, "Message too long"),
  segment: z.enum(["ALL", "VIP"]).optional(),
  campaignName: z.string().optional(),
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

      const { programId, message, segment, campaignName } = validation.data;

      console.log(`📢 Broadcast request received for program: ${programId}`);

      const result = await notificationService.sendBroadcast(
        programId,
        message,
        segment,
        campaignName
      );

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
}

export const notificationController = new NotificationController();
