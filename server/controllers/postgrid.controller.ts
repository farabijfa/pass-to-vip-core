import type { Request, Response, NextFunction } from "express";
import { postGridService } from "../services";
import type { PostGridMail, ApiResponse } from "@shared/schema";
import { randomUUID } from "crypto";

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
      requestId: requestId || randomUUID(),
      timestamp: new Date().toISOString(),
    },
  };
}

export class PostGridController {
  async sendDirectMail(req: Request, res: Response, next: NextFunction) {
    const requestId = (req.headers["x-request-id"] as string) || randomUUID();
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
    const requestId = (req.headers["x-request-id"] as string) || randomUUID();

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
    const requestId = (req.headers["x-request-id"] as string) || randomUUID();

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
    const requestId = (req.headers["x-request-id"] as string) || randomUUID();

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
}

export const postGridController = new PostGridController();
