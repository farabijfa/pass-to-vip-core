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
