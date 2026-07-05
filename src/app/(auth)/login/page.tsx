// searchParams is a Promise in Next.js v16 — must await before reading.
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata = { title: "Sign In" };

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  "access-denied": "You cancelled the sign-in. Please try again.",
  "state-mismatch": "Sign-in request expired or was tampered with. Please try again.",
  "missing-params": "Invalid sign-in callback. Please try again.",
  "unknown-provider": "Unknown sign-in provider.",
  "server-error": "Something went wrong during sign-in. Please try again.",
};

interface Props {
  searchParams: Promise<{ verified?: string; oauth_error?: string }>;
}

export default async function LoginPage({ searchParams }: Props) {
  const { verified, oauth_error } = await searchParams;
  const oauthErrorMsg = oauth_error
    ? (OAUTH_ERROR_MESSAGES[oauth_error] ?? "Sign-in failed. Please try again.")
    : null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-4">
        {verified === "true" && (
          <div className="rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
            Email verified! You can now sign in.
          </div>
        )}
        {verified === "already" && (
          <div className="rounded-md bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-700">
            Your email is already verified. Sign in below.
          </div>
        )}
        {oauthErrorMsg && (
          <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {oauthErrorMsg}
          </div>
        )}
        {/* Suspense is required because LoginForm uses useSearchParams() */}
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
