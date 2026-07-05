// GET /api/auth/oauth/[provider]
//
// Step 1-2 of the OAuth flow: redirect the user to the provider.
//
// Before redirecting we:
// a) Generate a random state token (CSRF protection)
// b) Store it in a short-lived, HTTP-only cookie
// c) Include it in the redirect URL
//
// On callback we verify the state from the URL matches the cookie.
// If they don't match → reject (someone crafted a fake callback URL).

import { NextRequest, NextResponse } from "next/server";
import { buildAuthUrl, type OAuthProvider } from "@/lib/auth/oauth";
import { generateToken } from "@/lib/auth/tokens";
import { cookies } from "next/headers";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;

  // Validate provider early — don't redirect to unknown providers
  if (provider !== "google" && provider !== "github") {
    return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
  }

  // Check credentials are configured before redirecting
  const clientIdKey = provider === "google" ? "GOOGLE_CLIENT_ID" : "GITHUB_CLIENT_ID";
  if (!process.env[clientIdKey]) {
    return NextResponse.json(
      {
        error: `${provider} OAuth is not configured. Add ${clientIdKey} to your .env file.`,
        docs: provider === "google"
          ? "https://console.cloud.google.com/apis/credentials"
          : "https://github.com/settings/developers",
      },
      { status: 503 }
    );
  }

  const state = generateToken(16); // 128-bit random state
  const redirectUri = `${APP_URL}/api/auth/oauth/${provider}/callback`;
  const authUrl = buildAuthUrl(provider as OAuthProvider, redirectUri, state);

  // Store state in an HTTP-only cookie (5-min expiry — user must complete flow)
  const cookieStore = await cookies();
  cookieStore.set(`oauth_state_${provider}`, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 5,
  });

  return NextResponse.redirect(authUrl);
}
