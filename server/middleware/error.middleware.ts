import type { Request, Response, NextFunction } from "express";
import { generate } from "short-uuid";
import type { ApiResponse } from "@shared/schema";

export class AppError extends Error {
  public statusCode: number;
  public code: string;
  public details?: any;

  constructor(statusCode: number, code: string, message: string, details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

function createErrorResponse(
  code: string,
  message: string,
  details?: any,
  requestId?: string
): ApiResponse<never> {
  return {
    success: false,
    error: {
      code,
      message,
      details,
    },
    metadata: {
      requestId: requestId || generate(),
      timestamp: new Date().toISOString(),
    },
  };
}

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const requestId = (req.headers["x-request-id"] as string) || generate();

  console.error("Error:", {
    requestId,
    name: err.name,
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  if (err instanceof AppError) {
    return res.status(err.statusCode).json(
      createErrorResponse(err.code, err.message, err.details, requestId)
    );
  }

  if (err.name === "SyntaxError" && "body" in err) {
    return res.status(400).json(
      createErrorResponse(
        "INVALID_JSON",
        "Invalid JSON in request body",
        undefined,
        requestId
      )
    );
  }

  if (err.name === "UnauthorizedError") {
    return res.status(401).json(
      createErrorResponse(
        "UNAUTHORIZED",
        "Authentication required",
        undefined,
        requestId
      )
    );
  }

  return res.status(500).json(
    createErrorResponse(
      "INTERNAL_ERROR",
      "An unexpected error occurred",
      process.env.NODE_ENV === "development" ? err.message : undefined,
      requestId
    )
  );
};

export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  const requestId = (req.headers["x-request-id"] as string) || generate();

  return res.status(404).json(
    createErrorResponse(
      "NOT_FOUND",
      `Route ${req.method} ${req.path} not found`,
      undefined,
      requestId
    )
  );
};

export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
