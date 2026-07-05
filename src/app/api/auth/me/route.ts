// GET /api/auth/me
//
// Returns the currently authenticated user's profile.
// Used by client components to know who is logged in without storing
// user data in localStorage or client state that survives page refreshes.

import { NextResponse } from "next/server";
import { getSessionFromCookie } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import type { ApiResponse, SafeUser } from "@/types/auth";

export async function GET() {
  const session = await getSessionFromCookie();

  if (!session) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Not authenticated" },
      { status: 401 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      emailVerified: true,
      image: true,
      createdAt: true,
    },
  });

  if (!user) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: "User not found" },
      { status: 404 }
    );
  }

  const safeUser: SafeUser = {
    ...user,
    emailVerified: user.emailVerified !== null,
  };

  return NextResponse.json<ApiResponse<SafeUser>>({
    success: true,
    data: safeUser,
  });
}
