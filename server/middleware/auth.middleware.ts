import type { Request, Response, NextFunction } from "express";
import { createClient } from "@supabase/supabase-js";
import { config, isSupabaseConfigured } from "../config";

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "phygital2024";
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || "pk_phygital_admin_2024";

export interface AuthenticatedRequest extends Request {
  userId?: string;
  userEmail?: string;
}

export async function jwtAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!isSupabaseConfigured()) {
    return res.status(503).json({
      success: false,
      error: {
        code: "SERVICE_UNAVAILABLE",
        message: "Database service not configured",
      },
    });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      error: {
        code: "MISSING_TOKEN",
        message: "Authorization header with Bearer token is required",
      },
    });
  }

  const token = authHeader.substring(7);

  try {
    const supabase = createClient(
      config.supabase.url,
      config.supabase.anonKey || config.supabase.serviceRoleKey,
      {
        global: {
          headers: { Authorization: `Bearer ${token}` },
        },
      }
    );

    const { data: userData, error: userError } = await supabase.auth.getUser(token);

    if (userError || !userData.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: "INVALID_TOKEN",
          message: userError?.message || "Invalid or expired token",
        },
      });
    }

    req.userId = userData.user.id;
    req.userEmail = userData.user.email || undefined;
    return next();
  } catch (error) {
    console.error("JWT auth error:", error);
    return res.status(401).json({
      success: false,
      error: {
        code: "AUTH_ERROR",
        message: "Authentication failed",
      },
    });
  }
}

export function checkApiKey(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers["x-api-key"] as string;

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: {
        code: "MISSING_API_KEY",
        message: "API key is required. Provide it via x-api-key header.",
      },
    });
  }

  if (apiKey !== ADMIN_API_KEY) {
    return res.status(403).json({
      success: false,
      error: {
        code: "INVALID_API_KEY",
        message: "Invalid API key",
      },
    });
  }

  return next();
}

export function basicAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Basic ")) {
    res.setHeader("WWW-Authenticate", 'Basic realm="Admin Dashboard"');
    return res.status(401).json({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required",
      },
    });
  }

  const base64Credentials = authHeader.split(" ")[1];
  const credentials = Buffer.from(base64Credentials, "base64").toString("utf8");
  const [username, password] = credentials.split(":");

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    return next();
  }

  res.setHeader("WWW-Authenticate", 'Basic realm="Admin Dashboard"');
  return res.status(401).json({
    success: false,
    error: {
      code: "INVALID_CREDENTIALS",
      message: "Invalid username or password",
    },
  });
}
