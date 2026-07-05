// POST /api/auth/forgot-password
// { email: string }
//
// Initiates the password reset flow.
// Always returns 200 regardless of whether the email exists.
//
// WHY 15-minute expiry?
// A password reset link is a temporary credential that grants account access.
// Shorter window = smaller exposure if the email is intercepted or forwarded.
// 15 minutes is long enough for a human to act, short enough to limit risk.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { generateToken, hashToken, expiresInMinutes } from "@/lib/auth/tokens";
import { sendEmail } from "@/lib/email/send";
import { passwordResetEmail } from "@/lib/email/templates";
import { forgotPasswordSchema } from "@/lib/validations/auth";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import type { ApiResponse } from "@/types/auth";

const OK: ApiResponse = {
  success: true,
  data: undefined,
  message: "If that email is registered, you'll receive a reset link shortly.",
};

export async function POST(request: NextRequest) {
  try {
    if (!rateLimit(`forgot-password:${getClientIp(request)}`, 3, 15 * 60 * 1000)) {
      return NextResponse.json<ApiResponse>(OK); // don't reveal rate limiting to avoid enumeration
    }

    const body = await request.json();
    const result = forgotPasswordSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json<ApiResponse>(OK);
    }

    const { email } = result.data;
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, emailVerified: true },
    });

    if (!user) return NextResponse.json<ApiResponse>(OK);

    // Delete any existing reset tokens (user may have requested multiple times)
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

    const token = generateToken();
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token: hashToken(token),
        expiresAt: expiresInMinutes(15),
      },
    });

    const template = passwordResetEmail(user.name, token);
    await sendEmail({ to: email, ...template });

    return NextResponse.json<ApiResponse>(OK);
  } catch (error) {
    console.error("[forgot-password] error:", error);
    return NextResponse.json<ApiResponse>(OK);
  }
}
