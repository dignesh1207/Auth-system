// POST /api/auth/register
//
// Registration flow:
// 1. Validate input (Zod) — reject malformed data before touching the DB
// 2. Check email isn't already taken
// 3. Hash the password (bcrypt, cost 12)
// 4. Create the user record
// 5. Create a one-time email verification token (24hr expiry)
// 6. Send the verification email
// 7. Return 201 — do NOT auto-login; force email verification first

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { hashPassword } from "@/lib/auth/password";
import { generateToken, hashToken, expiresInHours } from "@/lib/auth/tokens";
import { registerSchema } from "@/lib/validations/auth";
import { sendEmail } from "@/lib/email/send";
import { verificationEmail } from "@/lib/email/templates";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import type { ApiResponse, SafeUser } from "@/types/auth";

export async function POST(request: NextRequest) {
  try {
    if (!rateLimit(`register:${getClientIp(request)}`, 5, 60 * 60 * 1000)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Too many attempts. Please try again later." },
        { status: 429 }
      );
    }

    // ── 1. Parse + validate input ──────────────────────────────────────────
    const body = await request.json();
    const result = registerSchema.safeParse(body);

    if (!result.success) {
      // Flatten Zod errors into { fieldName: ["error msg", ...] }
      const details = result.error.flatten().fieldErrors as Record<
        string,
        string[]
      >;
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Validation failed", details },
        { status: 422 }
      );
    }

    const { name, email, password } = result.data;

    // ── 2. Check for duplicate email ───────────────────────────────────────
    // WHY: Unique constraint at the DB level will also catch this, but we want
    // a friendly error message rather than a raw DB exception.
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true }, // only fetch what we need
    });

    if (existingUser) {
      // SECURITY NOTE: Some systems return a generic message here to avoid
      // exposing which emails are registered. For a learning project we'll
      // keep it explicit, but consider obscuring this in production.
      return NextResponse.json<ApiResponse>(
        { success: false, error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    // ── 3. Hash the password ───────────────────────────────────────────────
    // This is intentionally slow (~250ms). Don't try to speed it up.
    const passwordHash = await hashPassword(password);

    // ── 4 + 5. Create user + verification token in a transaction ──────────
    // WHY a transaction? If the token insert fails, we don't want an orphaned
    // user who can never verify their email.
    const { user, token: verificationToken } = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const user = await tx.user.create({
        data: {
          name,
          email,
          passwordHash,
        },
      });

      const token = generateToken();
      await tx.verificationToken.create({
        data: {
          userId: user.id,
          token: hashToken(token),
          expiresAt: expiresInHours(24),
        },
      });

      return { user, token };
    });

    // ── 6. Send verification email ─────────────────────────────────────────
    const template = verificationEmail(name, verificationToken);
    await sendEmail({ to: email, ...template });

    // ── 7. Return success (201 Created) ────────────────────────────────────
    // We return a SafeUser — never the passwordHash!
    const safeUser: SafeUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      emailVerified: user.emailVerified !== null,
      image: user.image,
      createdAt: user.createdAt,
    };

    return NextResponse.json<ApiResponse<SafeUser>>(
      {
        success: true,
        data: safeUser,
        message:
          "Account created. Check your email to verify your address before logging in.",
      },
      { status: 201 }
    );
  } catch (error) {
    // Generic 500 — never expose raw error details to clients
    console.error("[register] unexpected error:", error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
