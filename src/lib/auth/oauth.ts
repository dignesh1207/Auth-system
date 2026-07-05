// OAuth provider configurations and helpers.
//
// We implement the Authorization Code Flow manually (no NextAuth) so you
// can see exactly what's happening at each step. In production you'd likely
// use a library, but understanding the raw flow helps you debug it.
//
// Supported providers: "google" | "github"

export type OAuthProvider = "google" | "github";

// ── Provider configs ──────────────────────────────────────────────────────────

interface ProviderConfig {
  authUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scopes: string[];
  clientId: () => string;
  clientSecret: () => string;
}

const PROVIDERS: Record<OAuthProvider, ProviderConfig> = {
  google: {
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    userInfoUrl: "https://www.googleapis.com/oauth2/v3/userinfo",
    scopes: ["openid", "email", "profile"],
    clientId: () => requireEnv("GOOGLE_CLIENT_ID"),
    clientSecret: () => requireEnv("GOOGLE_CLIENT_SECRET"),
  },
  github: {
    authUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    userInfoUrl: "https://api.github.com/user",
    scopes: ["read:user", "user:email"],
    clientId: () => requireEnv("GITHUB_CLIENT_ID"),
    clientSecret: () => requireEnv("GITHUB_CLIENT_SECRET"),
  },
};

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing env var: ${key}`);
  return val;
}

export function getProvider(provider: string): ProviderConfig {
  if (!(provider in PROVIDERS)) {
    throw new Error(`Unknown OAuth provider: ${provider}`);
  }
  return PROVIDERS[provider as OAuthProvider];
}

// ── Step 2: Build the authorization URL ──────────────────────────────────────
// The URL we redirect the user to on the provider's site.

export function buildAuthUrl(
  provider: OAuthProvider,
  redirectUri: string,
  state: string
): string {
  const config = getProvider(provider);
  const params = new URLSearchParams({
    client_id: config.clientId(),
    redirect_uri: redirectUri,
    response_type: "code",
    scope: config.scopes.join(" "),
    state,
    // Google-specific: always show account picker even if already signed in
    ...(provider === "google" && { prompt: "select_account" }),
  });
  return `${config.authUrl}?${params}`;
}

// ── Step 5: Exchange code for access token ────────────────────────────────────

interface TokenResponse {
  access_token: string;
  token_type: string;
  scope?: string;
}

export async function exchangeCodeForToken(
  provider: OAuthProvider,
  code: string,
  redirectUri: string
): Promise<string> {
  const config = getProvider(provider);

  const res = await fetch(config.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json", // GitHub returns form-encoded by default
    },
    body: new URLSearchParams({
      client_id: config.clientId(),
      client_secret: config.clientSecret(),
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const data = (await res.json()) as TokenResponse & { error?: string };
  if (data.error || !data.access_token) {
    throw new Error(`Token exchange failed: ${data.error ?? "no access_token"}`);
  }
  return data.access_token;
}

// ── Step 6: Fetch the user's profile from the provider ───────────────────────

export interface OAuthUserInfo {
  providerAccountId: string; // the user's ID on the provider
  email: string;
  name: string | null;
  image: string | null;
}

export async function fetchOAuthUser(
  provider: OAuthProvider,
  accessToken: string
): Promise<OAuthUserInfo> {
  const config = getProvider(provider);

  const res = await fetch(config.userInfoUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Failed to fetch user info from ${provider}`);

  if (provider === "google") {
    const data = await res.json() as {
      sub: string; email: string; name?: string; picture?: string;
    };
    return {
      providerAccountId: data.sub,
      email: data.email,
      name: data.name ?? null,
      image: data.picture ?? null,
    };
  }

  if (provider === "github") {
    const data = await res.json() as {
      id: number; login: string; name?: string; avatar_url?: string; email?: string | null;
    };

    // GitHub users can hide their email — if so, fetch from the emails endpoint
    let email = data.email ?? null;
    if (!email) {
      const emailRes = await fetch("https://api.github.com/user/emails", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (emailRes.ok) {
        const emails = await emailRes.json() as Array<{
          email: string; primary: boolean; verified: boolean;
        }>;
        email = emails.find((e) => e.primary && e.verified)?.email ?? null;
      }
    }

    if (!email) throw new Error("Could not retrieve email from GitHub account");

    return {
      providerAccountId: String(data.id),
      email,
      name: data.name ?? data.login,
      image: data.avatar_url ?? null,
    };
  }

  throw new Error(`fetchOAuthUser: unhandled provider ${provider}`);
}
