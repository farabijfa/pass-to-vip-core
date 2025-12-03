import type { Request, Response, NextFunction } from "express";
import { generate } from "short-uuid";

export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const requestId = (req.headers["x-request-id"] as string) || generate();
  
  req.headers["x-request-id"] = requestId;
  res.setHeader("X-Request-ID", requestId);
  
  next();
};
