import jwt from 'jsonwebtoken';

export function generatePassKitToken(): string | null {
  const key = process.env.PASSKIT_API_KEY;
  const secret = process.env.PASSKIT_API_SECRET;

  if (!key || !secret) {
    return null;
  }

  const payload = {
    uid: key,  // PassKit requires 'uid' claim, not 'key'
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60
  };

  return jwt.sign(payload, secret);
}

/**
 * Generate a PassKit JWT token from program-specific credentials
 * Used when programs have their own PassKit API keys stored in Supabase
 */
export function generatePassKitTokenFromCredentials(apiKey: string, apiSecret: string): string | null {
  if (!apiKey || !apiSecret) {
    return null;
  }

  const payload = {
    uid: apiKey,  // PassKit requires 'uid' claim
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60
  };

  return jwt.sign(payload, apiSecret);
}
