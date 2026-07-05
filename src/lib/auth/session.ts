// Cookie management for auth tokens.
// All cookie operations MUST happen in Route Handlers or Server Functions —
// you cannot set cookies during Server Component rendering.

import "server-only";
import { cookies } from "next/headers";
import { verifyAccessToken } from "./jwt";
import type { JWTPayload } from "@/types/auth";

export const ACCESS_TOKEN_COOKIE = "auth_token";
export const REFRESH_TOKEN_COOKIE = "auth_refresh";

// Cookie lifetime in seconds matching JWT expiry
const ACCESS_MAX_AGE = 15 * 60;        // 15 minutes
const REFRESH_MAX_AGE = 7 * 24 * 3600; // 7 days

// ── Set ───────────────────────────────────────────────────────────────────────

export async function setAccessTokenCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(ACCESS_TOKEN_COOKIE, token, {
    httpOnly: true,                                      // JS can't read it
    secure: process.env.NODE_ENV === "production",       // HTTPS only in prod
    sameSite: "lax",                                     // CSRF protection
    path: "/",
    maxAge: ACCESS_MAX_AGE,
  });
}

export async function setRefreshTokenCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(REFRESH_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/refresh",  // scoped — only sent to the refresh endpoint
    maxAge: REFRESH_MAX_AGE,
  });
}

// ── Get ───────────────────────────────────────────────────────────────────────

// Read and verify the access token from the cookie.
// Returns the decoded payload or null if missing/expired/tampered.
export async function getSessionFromCookie(): Promise<JWTPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!token) return null;
  return verifyAccessToken(token);
}

// ── Delete (logout) ───────────────────────────────────────────────────────────

export async function clearAuthCookies(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ACCESS_TOKEN_COOKIE);
  cookieStore.delete(REFRESH_TOKEN_COOKIE);
}
