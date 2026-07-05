// POST /api/auth/reset-password
// { token: string, password: string, confirmPassword: string }
//
// Completes the password reset:
// 1. Validate input
// 2. Find the reset token
// 3. Check it hasn't expired
// 4. Hash the new password
// 5. Update the user's password + invalidate ALL their sessions
// 6. Delete the token (one-time use)
// 7. Auto-login: issue a new access token cookie
//
// Step 5 (invalidate sessions) is important: if an attacker had an active
// session before the reset, they lose it. The legitimate user's password
// reset should lock everyone else out.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";
import { hashToken } from "@/lib/auth/tokens";
import { signAccessToken } from "@/lib/auth/jwt";
import { setAccessTokenCookie } from "@/lib/auth/session";
import { resetPasswordSchema } from "@/lib/validations/auth";
import type { ApiResponse, SafeUser } from "@/types/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = resetPasswordSchema.safeParse(body);

    if (!result.success) {
      const details = result.error.flatten().fieldErrors as Record<string, string[]>;
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Validation failed", details },
        { status: 422 }
      );
    }

    const { token, password } = result.data;

    const record = await prisma.passwordResetToken.findUnique({
      where: { token: hashToken(token) },
      include: {
        user: {
          select: {
            id: true, email: true, name: true,
            role: true, emailVerified: true, image: true, createdAt: true,
          },
        },
      },
    });

    if (!record) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Invalid or expired reset link." },
        { status: 400 }
      );
    }

    if (record.expiresAt < new Date()) {
      await prisma.passwordResetToken.delete({ where: { id: record.id } });
      return NextResponse.json<ApiResponse>(
        { success: false, error: "This reset link has expired. Please request a new one." },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(password);

    // Update password + wipe all sessions + delete reset token — all atomic
    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      }),
      prisma.session.deleteMany({ where: { userId: record.userId } }),
      prisma.passwordResetToken.delete({ where: { id: record.id } }),
    ]);

    const { user } = record;

    // Auto-login after successful reset (better UX than forcing them to log in again)
    const accessToken = await signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified !== null,
    });
    await setAccessTokenCookie(accessToken);

    const safeUser: SafeUser = {
      ...user,
      emailVerified: user.emailVerified !== null,
    };

    return NextResponse.json<ApiResponse<SafeUser>>({
      success: true,
      data: safeUser,
      message: "Password reset successfully.",
    });
  } catch (error) {
    console.error("[reset-password] error:", error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
