// GET /api/auth/verify-email?token=<hex-token>
//
// Verification flow:
// 1. Read the token from the query string
// 2. Look it up in the database
// 3. Check it hasn't expired
// 4. Mark the user's email as verified
// 5. Delete the token (one-time use!)
// 6. Redirect to /login with a success message
//
// WHY a GET (link click) instead of a POST?
// Verification links are clicked from email. Email clients follow URLs as GETs.
// We can't require a form submission for a link click.
//
// WHY redirect instead of returning JSON?
// This endpoint is hit directly from a browser link click, not from a fetch()
// call. The user needs to end up on a page — so we redirect.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { hashToken } from "@/lib/auth/tokens";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  const fail = (reason: string) =>
    NextResponse.redirect(
      new URL(`/verify-email?error=${encodeURIComponent(reason)}`, request.nextUrl)
    );

  if (!token) return fail("missing-token");

  const record = await prisma.verificationToken.findUnique({
    where: { token: hashToken(token) },
    include: { user: { select: { id: true, emailVerified: true } } },
  });

  if (!record) return fail("invalid-token");

  // Already verified (e.g. user clicked the link twice)
  if (record.user.emailVerified) {
    return NextResponse.redirect(new URL("/login?verified=already", request.nextUrl));
  }

  if (record.expiresAt < new Date()) {
    // Clean up the stale token
    await prisma.verificationToken.delete({ where: { id: record.id } });
    return fail("expired-token");
  }

  // Mark verified + delete token atomically
  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { emailVerified: new Date() },
    }),
    prisma.verificationToken.delete({ where: { id: record.id } }),
  ]);

  return NextResponse.redirect(new URL("/login?verified=true", request.nextUrl));
}
