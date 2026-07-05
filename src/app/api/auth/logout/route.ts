// POST /api/auth/logout
//
// Logout just deletes the auth cookies on the server side.
// The JWT may still be technically valid for up to 15 minutes after logout
// (until it expires naturally), but without the cookie the browser won't
// send it. This is the tradeoff of stateless tokens — true server-side
// revocation requires the Session table (implemented in Phase 2b with
// refresh tokens).

import { NextResponse } from "next/server";
import { clearAuthCookies } from "@/lib/auth/session";
import type { ApiResponse } from "@/types/auth";

export async function POST() {
  await clearAuthCookies();

  return NextResponse.json<ApiResponse<undefined>>({
    success: true,
    data: undefined,
    message: "Logged out successfully",
  });
}
