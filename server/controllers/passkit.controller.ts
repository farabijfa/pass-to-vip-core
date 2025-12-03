import type { Request, Response, NextFunction } from "express";
import { passKitService } from "../services";
import type { PassKitPass, PassKitUpdate, ApiResponse } from "@shared/schema";
import { generate } from "short-uuid";

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

export class PassKitController {
  async createPass(req: Request, res: Response, next: NextFunction) {
    const requestId = (req.headers["x-request-id"] as string) || generate();
    const startTime = Date.now();

    try {
      const passData: PassKitPass = req.body;

      const result = await passKitService.createPass(passData);

      if (!result.success) {
        return res.status(400).json(
          createResponse(
            false,
            undefined,
            {
              code: "PASS_CREATION_FAILED",
              message: result.error || "Failed to create digital wallet pass",
            },
            requestId
          )
        );
      }

      const response = createResponse(
        true,
        {
          passId: result.passId,
          downloadUrl: result.downloadUrl,
          serialNumber: passData.serialNumber,
          memberId: passData.memberId,
          createdAt: new Date().toISOString(),
        },
        undefined,
        requestId
      );

      response.metadata!.processingTime = Date.now() - startTime;

      return res.status(201).json(response);
    } catch (error) {
      console.error("Create pass error:", error);
      return res.status(500).json(
        createResponse(
          false,
          undefined,
          {
            code: "INTERNAL_ERROR",
            message: "An unexpected error occurred while creating the pass",
          },
          requestId
        )
      );
    }
  }

  async updatePass(req: Request, res: Response, next: NextFunction) {
    const requestId = (req.headers["x-request-id"] as string) || generate();
    const startTime = Date.now();

    try {
      const { serialNumber } = req.params;
      const updates = req.body;

      const updateData: PassKitUpdate = {
        serialNumber,
        updates,
      };

      const result = await passKitService.updatePass(updateData);

      if (!result.success) {
        return res.status(400).json(
          createResponse(
            false,
            undefined,
            {
              code: "PASS_UPDATE_FAILED",
              message: result.error || "Failed to update digital wallet pass",
            },
            requestId
          )
        );
      }

      const response = createResponse(
        true,
        {
          serialNumber,
          updatedAt: new Date().toISOString(),
          message: result.message,
        },
        undefined,
        requestId
      );

      response.metadata!.processingTime = Date.now() - startTime;

      return res.status(200).json(response);
    } catch (error) {
      console.error("Update pass error:", error);
      return res.status(500).json(
        createResponse(
          false,
          undefined,
          {
            code: "INTERNAL_ERROR",
            message: "An unexpected error occurred while updating the pass",
          },
          requestId
        )
      );
    }
  }

  async getPass(req: Request, res: Response, next: NextFunction) {
    const requestId = (req.headers["x-request-id"] as string) || generate();

    try {
      const { serialNumber } = req.params;

      if (!serialNumber) {
        return res.status(400).json(
          createResponse(
            false,
            undefined,
            {
              code: "INVALID_REQUEST",
              message: "Serial number is required",
            },
            requestId
          )
        );
      }

      const pass = await passKitService.getPass(serialNumber);

      if (!pass) {
        return res.status(404).json(
          createResponse(
            false,
            undefined,
            {
              code: "PASS_NOT_FOUND",
              message: "Digital wallet pass not found",
            },
            requestId
          )
        );
      }

      return res.status(200).json(
        createResponse(true, pass, undefined, requestId)
      );
    } catch (error) {
      console.error("Get pass error:", error);
      return res.status(500).json(
        createResponse(
          false,
          undefined,
          {
            code: "INTERNAL_ERROR",
            message: "An unexpected error occurred while retrieving the pass",
          },
          requestId
        )
      );
    }
  }

  async deletePass(req: Request, res: Response, next: NextFunction) {
    const requestId = (req.headers["x-request-id"] as string) || generate();

    try {
      const { serialNumber } = req.params;

      if (!serialNumber) {
        return res.status(400).json(
          createResponse(
            false,
            undefined,
            {
              code: "INVALID_REQUEST",
              message: "Serial number is required",
            },
            requestId
          )
        );
      }

      const result = await passKitService.deletePass(serialNumber);

      if (!result.success) {
        return res.status(400).json(
          createResponse(
            false,
            undefined,
            {
              code: "PASS_DELETION_FAILED",
              message: result.error || "Failed to delete digital wallet pass",
            },
            requestId
          )
        );
      }

      return res.status(200).json(
        createResponse(
          true,
          {
            serialNumber,
            deletedAt: new Date().toISOString(),
          },
          undefined,
          requestId
        )
      );
    } catch (error) {
      console.error("Delete pass error:", error);
      return res.status(500).json(
        createResponse(
          false,
          undefined,
          {
            code: "INTERNAL_ERROR",
            message: "An unexpected error occurred while deleting the pass",
          },
          requestId
        )
      );
    }
  }

  async sendPushNotification(req: Request, res: Response, next: NextFunction) {
    const requestId = (req.headers["x-request-id"] as string) || generate();

    try {
      const { serialNumber } = req.params;
      const { message } = req.body;

      if (!serialNumber || !message) {
        return res.status(400).json(
          createResponse(
            false,
            undefined,
            {
              code: "INVALID_REQUEST",
              message: "Serial number and message are required",
            },
            requestId
          )
        );
      }

      const result = await passKitService.sendPushNotification(serialNumber, message);

      if (!result.success) {
        return res.status(400).json(
          createResponse(
            false,
            undefined,
            {
              code: "PUSH_NOTIFICATION_FAILED",
              message: result.error || "Failed to send push notification",
            },
            requestId
          )
        );
      }

      return res.status(200).json(
        createResponse(
          true,
          {
            serialNumber,
            notificationSent: true,
            sentAt: new Date().toISOString(),
          },
          undefined,
          requestId
        )
      );
    } catch (error) {
      console.error("Send push notification error:", error);
      return res.status(500).json(
        createResponse(
          false,
          undefined,
          {
            code: "INTERNAL_ERROR",
            message: "An unexpected error occurred while sending the notification",
          },
          requestId
        )
      );
    }
  }

  async enrollMember(req: Request, res: Response, next: NextFunction) {
    const requestId = (req.headers["x-request-id"] as string) || generate();
    const startTime = Date.now();

    try {
      const { programId, email, firstName, lastName, points, tierId } = req.body;

      if (!programId) {
        return res.status(400).json(
          createResponse(
            false,
            undefined,
            {
              code: "INVALID_REQUEST",
              message: "programId is required (PassKit Program ID from your client's program)",
            },
            requestId
          )
        );
      }

      if (!email) {
        return res.status(400).json(
          createResponse(
            false,
            undefined,
            {
              code: "INVALID_REQUEST",
              message: "email is required for member enrollment",
            },
            requestId
          )
        );
      }

      console.log(`[Enroll] Creating member for program: ${programId}, email: ${email}`);

      const result = await passKitService.enrollMember(programId, {
        email,
        firstName,
        lastName,
        points: points || 0,
        tierId,
      });

      if (!result.success) {
        return res.status(400).json(
          createResponse(
            false,
            undefined,
            {
              code: "ENROLLMENT_FAILED",
              message: result.error || "Failed to enroll member",
            },
            requestId
          )
        );
      }

      const response = createResponse(
        true,
        {
          passkit_internal_id: result.passkit_internal_id,
          external_id: result.external_id,
          install_url: result.install_url,
          programId,
          email,
          enrolledAt: new Date().toISOString(),
        },
        undefined,
        requestId
      );

      response.metadata!.processingTime = Date.now() - startTime;

      return res.status(201).json(response);
    } catch (error) {
      console.error("Enroll member error:", error);
      return res.status(500).json(
        createResponse(
          false,
          undefined,
          {
            code: "INTERNAL_ERROR",
            message: "An unexpected error occurred while enrolling the member",
          },
          requestId
        )
      );
    }
  }
}

export const passKitController = new PassKitController();
