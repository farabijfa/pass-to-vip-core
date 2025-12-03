import type { Request, Response, NextFunction } from "express";
import { supabaseService, passKitService, postGridService } from "../services";
import { config } from "../config";
import type { HealthCheck, ApiResponse } from "@shared/schema";
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

export class HealthController {
  async getHealth(req: Request, res: Response, next: NextFunction) {
    const requestId = (req.headers["x-request-id"] as string) || randomUUID();
    const startTime = Date.now();

    try {
      const [supabaseHealth, passKitHealth, postGridHealth] = await Promise.all([
        supabaseService.healthCheck(),
        passKitService.healthCheck(),
        postGridService.healthCheck(),
      ]);

      const allConnected = 
        supabaseHealth.status === "connected" &&
        passKitHealth.status === "connected" &&
        postGridHealth.status === "connected";

      const anyError = 
        supabaseHealth.status === "error" ||
        passKitHealth.status === "error" ||
        postGridHealth.status === "error";

      let overallStatus: "healthy" | "degraded" | "unhealthy";
      if (allConnected) {
        overallStatus = "healthy";
      } else if (anyError) {
        overallStatus = "unhealthy";
      } else {
        overallStatus = "degraded";
      }

      const healthData: HealthCheck = {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        version: config.server.apiVersion,
        services: {
          supabase: {
            status: supabaseHealth.status,
            latency: supabaseHealth.latency,
          },
          passKit: {
            status: passKitHealth.status,
          },
          postGrid: {
            status: postGridHealth.status,
          },
        },
      };

      const response = createResponse(true, healthData, undefined, requestId);
      response.metadata!.processingTime = Date.now() - startTime;

      const httpStatus = overallStatus === "healthy" ? 200 : overallStatus === "degraded" ? 207 : 503;

      return res.status(httpStatus).json(response);
    } catch (error) {
      console.error("Health check error:", error);
      return res.status(503).json(
        createResponse(
          false,
          undefined,
          {
            code: "HEALTH_CHECK_FAILED",
            message: "Unable to perform health check",
          },
          requestId
        )
      );
    }
  }

  async getReadiness(req: Request, res: Response, next: NextFunction) {
    const requestId = (req.headers["x-request-id"] as string) || randomUUID();

    try {
      const supabaseHealth = await supabaseService.healthCheck();

      const isReady = supabaseHealth.status === "connected" || supabaseHealth.status === "disconnected";

      if (isReady) {
        return res.status(200).json(
          createResponse(
            true,
            {
              ready: true,
              timestamp: new Date().toISOString(),
            },
            undefined,
            requestId
          )
        );
      }

      return res.status(503).json(
        createResponse(
          false,
          undefined,
          {
            code: "NOT_READY",
            message: "Service is not ready to accept traffic",
          },
          requestId
        )
      );
    } catch (error) {
      console.error("Readiness check error:", error);
      return res.status(503).json(
        createResponse(
          false,
          undefined,
          {
            code: "READINESS_CHECK_FAILED",
            message: "Unable to perform readiness check",
          },
          requestId
        )
      );
    }
  }

  async getLiveness(req: Request, res: Response, next: NextFunction) {
    const requestId = (req.headers["x-request-id"] as string) || randomUUID();

    return res.status(200).json(
      createResponse(
        true,
        {
          alive: true,
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
        },
        undefined,
        requestId
      )
    );
  }
}

export const healthController = new HealthController();
