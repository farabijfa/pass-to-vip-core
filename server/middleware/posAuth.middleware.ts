import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { getSupabaseClient, isSupabaseConfigured } from "../config/supabase";
import { generate } from "short-uuid";

export interface POSAuthRequest extends Request {
  posApiKey?: {
    id: string;
    programId: string;
    programName: string;
    label: string;
  };
  idempotencyKey?: string;
}

interface ApiKeyRecord {
  id: string;
  program_id: string;
  key_hash: string;
  label: string;
  is_active: boolean;
  last_used_at: string | null;
  programs: {
    id: string;
    name: string;
    is_suspended: boolean;
  };
}

function hashApiKey(apiKey: string): string {
  return crypto.createHash("sha256").update(apiKey).digest("hex");
}

export async function posApiKeyAuth(
  req: POSAuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const requestId = (req.headers["x-request-id"] as string) || generate();
  const apiKey = req.headers["x-api-key"] as string;

  if (!apiKey) {
    res.status(401).json({
      success: false,
      error: {
        code: "MISSING_API_KEY",
        message: "API key required. Include x-api-key header.",
      },
      metadata: {
        requestId,
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  if (!isSupabaseConfigured()) {
    res.status(503).json({
      success: false,
      error: {
        code: "SERVICE_UNAVAILABLE",
        message: "Database not configured",
      },
      metadata: {
        requestId,
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  try {
    const keyHash = hashApiKey(apiKey);
    const supabase = getSupabaseClient();

    const { data: keyRecord, error } = await supabase
      .from("pos_api_keys")
      .select(`
        id,
        program_id,
        key_hash,
        label,
        is_active,
        last_used_at,
        programs!inner (
          id,
          name,
          is_suspended
        )
      `)
      .eq("key_hash", keyHash)
      .eq("is_active", true)
      .single();

    if (error || !keyRecord) {
      console.log(`[POS Auth] Invalid API key attempted: ${apiKey.slice(0, 8)}...`);
      res.status(401).json({
        success: false,
        error: {
          code: "INVALID_API_KEY",
          message: "Invalid or inactive API key",
        },
        metadata: {
          requestId,
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    const program = keyRecord.programs as unknown as { id: string; name: string; is_suspended: boolean };

    if (program.is_suspended) {
      console.log(`[POS Auth] Program suspended: ${program.name}`);
      res.status(403).json({
        success: false,
        error: {
          code: "PROGRAM_SUSPENDED",
          message: "Program is currently suspended. Contact administrator.",
        },
        metadata: {
          requestId,
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    supabase
      .from("pos_api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", keyRecord.id)
      .then(() => {});

    req.posApiKey = {
      id: keyRecord.id,
      programId: keyRecord.program_id,
      programName: program.name,
      label: keyRecord.label,
    };

    const idempotencyKey = req.headers["idempotency-key"] as string;
    if (idempotencyKey) {
      req.idempotencyKey = idempotencyKey;
    }

    next();
  } catch (error) {
    console.error("[POS Auth] Error validating API key:", error);
    res.status(500).json({
      success: false,
      error: {
        code: "AUTH_ERROR",
        message: "Failed to validate API key",
      },
      metadata: {
        requestId,
        timestamp: new Date().toISOString(),
      },
    });
  }
}

export function generateApiKey(): { key: string; hash: string } {
  const key = `pk_live_${crypto.randomBytes(24).toString("hex")}`;
  const hash = hashApiKey(key);
  return { key, hash };
}

export async function checkIdempotency(
  programId: string,
  idempotencyKey: string
): Promise<{ isDuplicate: boolean; cachedResponse?: any }> {
  if (!isSupabaseConfigured()) {
    return { isDuplicate: false };
  }

  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from("pos_transactions")
      .select("id, response_body, created_at")
      .eq("program_id", programId)
      .eq("idempotency_key", idempotencyKey)
      .single();

    if (error || !data) {
      return { isDuplicate: false };
    }

    console.log(`[POS] Idempotent request detected: ${idempotencyKey}`);
    return {
      isDuplicate: true,
      cachedResponse: data.response_body,
    };
  } catch (error) {
    console.error("[POS] Idempotency check error:", error);
    return { isDuplicate: false };
  }
}

export async function storeTransaction(params: {
  programId: string;
  idempotencyKey?: string;
  action: "LOOKUP" | "EARN" | "REDEEM";
  externalId: string;
  points?: number;
  responseBody: any;
}): Promise<{ transactionId?: string }> {
  if (!isSupabaseConfigured()) {
    return {};
  }

  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from("pos_transactions")
      .insert({
        program_id: params.programId,
        idempotency_key: params.idempotencyKey || null,
        action: params.action,
        external_id: params.externalId,
        points: params.points || 0,
        response_body: params.responseBody,
        created_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) {
      console.error("[POS] Store transaction error:", error);
      return {};
    }

    return { transactionId: data?.id };
  } catch (error) {
    console.error("[POS] Store transaction error:", error);
    return {};
  }
}
