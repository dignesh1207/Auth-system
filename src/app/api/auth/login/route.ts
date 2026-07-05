// POST /api/auth/login
//
// Login flow:
// 1. Validate input (Zod)
// 2. Find user by email
// 3. Verify password with bcrypt
// 4. Check email is verified (block unverified users)
// 5. Sign a JWT access token containing minimal user info
// 6. Set it as an HTTP-only cookie
// 7. Return the safe user object (no passwordHash)
//
// Security note: steps 2 and 3 return the SAME generic error ("invalid
// credentials"). This prevents user enumeration — an attacker can't tell
// whether the email exists or the password was wrong.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { signAccessToken } from "@/lib/auth/jwt";
import { setAccessTokenCookie } from "@/lib/auth/session";
import { loginSchema } from "@/lib/validations/auth";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import type { ApiResponse, SafeUser } from "@/types/auth";

const INVALID_CREDENTIALS = "Invalid email or password";

export async function POST(request: NextRequest) {
  try {
    if (!rateLimit(`login:${getClientIp(request)}`, 10, 15 * 60 * 1000)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Too many attempts. Please try again later." },
        { status: 429 }
      );
    }

    // ── 1. Validate input ──────────────────────────────────────────────────
    const body = await request.json();
    const result = loginSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Validation failed" },
        { status: 422 }
      );
    }

    const { email, password } = result.data;

    // ── 2. Find user ───────────────────────────────────────────────────────
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        passwordHash: true,
        emailVerified: true,
        role: true,
        image: true,
        createdAt: true,
      },
    });

    // ── 3. Verify password (same error for missing user as wrong password) ─
    // WHY? Timing: we always call bcrypt.compare even if the user doesn't
    // exist, to prevent timing attacks that reveal whether an email is
    // registered. bcrypt.compare on a dummy hash takes the same time as a
    // real comparison.
    const DUMMY_HASH =
      "$2b$12$dummyhashtopreventtimingattacks.placeholder.value";
    const isValid = await verifyPassword(
      password,
      user?.passwordHash ?? DUMMY_HASH
    );

    if (!user || !isValid) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: INVALID_CREDENTIALS },
        { status: 401 }
      );
    }

    // ── 4. Block unverified emails ─────────────────────────────────────────
    if (!user.emailVerified) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            "Please verify your email address before logging in. Check your inbox for the verification link.",
        },
        { status: 403 }
      );
    }

    // ── 5. Sign access token ───────────────────────────────────────────────
    // Keep the JWT payload minimal — it's readable by anyone who base64-
    // decodes it. Never include passwordHash, SSN, credit card numbers, etc.
    const accessToken = await signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified !== null,
    });

    // ── 6. Set HTTP-only cookie ────────────────────────────────────────────
    await setAccessTokenCookie(accessToken);

    // ── 7. Return safe user ────────────────────────────────────────────────
    const safeUser: SafeUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      emailVerified: user.emailVerified !== null,
      image: user.image,
      createdAt: user.createdAt,
    };

    return NextResponse.json<ApiResponse<SafeUser>>({
      success: true,
      data: safeUser,
      message: "Logged in successfully",
    });
  } catch (error) {
    console.error("[login] unexpected error:", error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
