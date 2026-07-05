// POST /api/auth/resend-verification
// { email: string }
//
// Lets a user who lost the verification email request a new one.
// Security: we always return 200 regardless of whether the email exists —
// this prevents user enumeration (an attacker can't probe which emails are
// registered by watching for different responses).

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { generateToken, hashToken, expiresInHours } from "@/lib/auth/tokens";
import { sendEmail } from "@/lib/email/send";
import { verificationEmail } from "@/lib/email/templates";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { z } from "zod";
import type { ApiResponse } from "@/types/auth";

const schema = z.object({
  email: z.string().email().toLowerCase().trim(),
});

const OK: ApiResponse = {
  success: true,
  data: undefined,
  message: "If that email is registered and unverified, we've sent a new link.",
};

export async function POST(request: NextRequest) {
  try {
    if (!rateLimit(`resend-verification:${getClientIp(request)}`, 3, 15 * 60 * 1000)) {
      return NextResponse.json<ApiResponse>(OK); // don't reveal rate limiting to avoid enumeration
    }

    const body = await request.json();
    const result = schema.safeParse(body);
    if (!result.success) {
      return NextResponse.json<ApiResponse>(OK); // don't reveal validation detail
    }

    const { email } = result.data;
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, emailVerified: true },
    });

    // Return OK even if user doesn't exist (anti-enumeration)
    if (!user || user.emailVerified) {
      return NextResponse.json<ApiResponse>(OK);
    }

    // Delete any existing tokens for this user and create a fresh one
    await prisma.verificationToken.deleteMany({ where: { userId: user.id } });

    const token = generateToken();
    await prisma.verificationToken.create({
      data: { userId: user.id, token: hashToken(token), expiresAt: expiresInHours(24) },
    });

    const template = verificationEmail(user.name, token);
    await sendEmail({ to: email, ...template });

    return NextResponse.json<ApiResponse>(OK);
  } catch (error) {
    console.error("[resend-verification] error:", error);
    return NextResponse.json<ApiResponse>(OK); // same response on error too
  }
}
