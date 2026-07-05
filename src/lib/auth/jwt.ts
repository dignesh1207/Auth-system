// JWT utilities using `jose` (not `jsonwebtoken`).
//
// WHY jose instead of jsonwebtoken?
// jsonwebtoken relies on Node.js crypto internals and can't run in Edge
// runtimes (Vercel Edge, Cloudflare Workers). jose uses the Web Crypto API
// which works everywhere — Node.js, Edge, browsers.
//
// WHY HS256?
// For a single server (or servers sharing one secret), HMAC-SHA256 is
// simple and fast. If you ever need multiple services to verify tokens
// independently, switch to RS256 (asymmetric) so you can share the public
// key without exposing your signing key.

import { SignJWT, jwtVerify } from "jose";
import type { JWTPayload } from "@/types/auth";

function getSecret(key: string): Uint8Array {
  const secret = process.env[key];
  if (!secret) throw new Error(`Missing env var: ${key}`);
  return new TextEncoder().encode(secret);
}

// ── Access token ──────────────────────────────────────────────────────────────
// Short-lived (15 min by default). Embedded in the HTTP-only cookie on login.
// The payload is readable by anyone who decodes the token — keep it minimal.

export async function signAccessToken(payload: JWTPayload): Promise<string> {
  const expiry = process.env.JWT_ACCESS_EXPIRY ?? "15m";
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiry)
    .sign(getSecret("JWT_ACCESS_SECRET"));
}

export async function verifyAccessToken(
  token: string
): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret("JWT_ACCESS_SECRET"));
    return payload as unknown as JWTPayload;
  } catch {
    // Expired, tampered, or malformed — treat as unauthenticated
    return null;
  }
}

// ── Refresh token ─────────────────────────────────────────────────────────────
// Long-lived (7 days). Only contains the userId — used solely to issue new
// access tokens. The raw token is never stored in DB; we store a sha256 hash.

export async function signRefreshToken(userId: string): Promise<string> {
  const expiry = process.env.JWT_REFRESH_EXPIRY ?? "7d";
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiry)
    .sign(getSecret("JWT_REFRESH_SECRET"));
}

export async function verifyRefreshToken(
  token: string
): Promise<{ sub: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret("JWT_REFRESH_SECRET"));
    return payload as { sub: string };
  } catch {
    return null;
  }
}
