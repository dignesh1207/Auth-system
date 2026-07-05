// src/proxy.ts — Next.js v16 route protection (renamed from middleware.ts)
//
// This runs on EVERY matched request BEFORE the page renders.
// It's the ideal place for auth redirects because it's cheap — we only
// read and cryptographically verify the cookie, no database query needed.
//
// WHY only optimistic checks here?
// The proxy runs at the edge (or on the server before rendering). Database
// calls here would add latency to every page load. The real authorization
// check ("does this user have permission to see THIS data?") should live in
// your data access layer (DAL), close to the database query itself.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyAccessToken } from "@/lib/auth/jwt";
import { ACCESS_TOKEN_COOKIE } from "@/lib/auth/session";

// Routes that require authentication
const PROTECTED_PREFIXES = ["/dashboard", "/settings", "/profile"];

// Routes that authenticated users should be redirected AWAY from
const AUTH_ROUTES = ["/login", "/register"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  const isAuthRoute = AUTH_ROUTES.some((p) => pathname.startsWith(p));

  // Read the token directly from the request cookies (faster than
  // importing `cookies()` from next/headers in the proxy context)
  const token = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value ?? null;
  const session = token ? await verifyAccessToken(token) : null;

  // Unauthenticated user trying to access a protected route → send to login
  if (isProtected && !session) {
    const loginUrl = new URL("/login", request.nextUrl);
    loginUrl.searchParams.set("from", pathname); // so we can redirect back after login
    return NextResponse.redirect(loginUrl);
  }

  // Authenticated user hitting login/register → send to dashboard
  if (isAuthRoute && session) {
    return NextResponse.redirect(new URL("/dashboard", request.nextUrl));
  }

  return NextResponse.next();
}

// Run the proxy on all routes except Next.js internals and static files.
// The negative lookahead skips: _next/static, _next/image, favicon, etc.
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon\\.ico).*)"],
};
