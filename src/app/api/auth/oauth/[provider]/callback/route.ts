// GET /api/auth/oauth/[provider]/callback?code=xxx&state=yyy
//
// Steps 3-7 of the OAuth flow.
//
// On error we redirect to /login?oauth_error=<reason> rather than returning
// JSON — this endpoint is always hit by a browser redirect, not a fetch().

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db/prisma";
import {
  exchangeCodeForToken,
  fetchOAuthUser,
  type OAuthProvider,
} from "@/lib/auth/oauth";
import { signAccessToken } from "@/lib/auth/jwt";
import { setAccessTokenCookie } from "@/lib/auth/session";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

function redirectError(reason: string) {
  return NextResponse.redirect(
    `${APP_URL}/login?oauth_error=${encodeURIComponent(reason)}`
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;

  if (provider !== "google" && provider !== "github") {
    return redirectError("unknown-provider");
  }

  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error"); // provider sent an error (e.g. user denied)

  if (error) return redirectError("access-denied");
  if (!code || !state) return redirectError("missing-params");

  // ── Verify state (CSRF check) ────────────────────────────────────────────
  const cookieStore = await cookies();
  const storedState = cookieStore.get(`oauth_state_${provider}`)?.value;
  cookieStore.delete(`oauth_state_${provider}`); // consume it — single use

  if (!storedState || storedState !== state) {
    return redirectError("state-mismatch");
  }

  try {
    // ── Exchange code → access token ───────────────────────────────────────
    const redirectUri = `${APP_URL}/api/auth/oauth/${provider}/callback`;
    const accessToken = await exchangeCodeForToken(
      provider as OAuthProvider,
      code,
      redirectUri
    );

    // ── Fetch user profile from provider ──────────────────────────────────
    const oauthUser = await fetchOAuthUser(provider as OAuthProvider, accessToken);

    // ── Upsert user + account in our DB ───────────────────────────────────
    // Strategy:
    // 1. Does an Account row exist for this provider + providerAccountId? → existing OAuth user
    // 2. Does a User exist with this email? → link new OAuth account to existing user
    // 3. Otherwise → create new User + Account

    const existingAccount = await prisma.account.findUnique({
      where: {
        provider_providerAccountId: {
          provider,
          providerAccountId: oauthUser.providerAccountId,
        },
      },
      include: { user: true },
    });

    let user = existingAccount?.user ?? null;

    if (!user) {
      // Check if a user with this email already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: oauthUser.email },
      });

      if (existingUser) {
        // Link this OAuth account to the existing user
        user = existingUser;
        await prisma.account.create({
          data: {
            userId: existingUser.id,
            provider,
            providerAccountId: oauthUser.providerAccountId,
          },
        });
      } else {
        // Brand new user — create User + Account together
        user = await prisma.user.create({
          data: {
            email: oauthUser.email,
            name: oauthUser.name,
            image: oauthUser.image,
            // OAuth providers pre-verify email — mark it immediately
            emailVerified: new Date(),
            accounts: {
              create: {
                provider,
                providerAccountId: oauthUser.providerAccountId,
              },
            },
          },
        });
      }
    }

    // ── Issue our JWT cookie ───────────────────────────────────────────────
    const accessTokenJwt = await signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified !== null,
    });
    await setAccessTokenCookie(accessTokenJwt);

    return NextResponse.redirect(`${APP_URL}/dashboard`);
  } catch (err) {
    console.error(`[oauth/${provider}/callback] error:`, err);
    return redirectError("server-error");
  }
}
