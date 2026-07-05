// /verify-email — shown after clicking a verification link.
// The actual verification happens in /api/auth/verify-email (a GET redirect).
// This page just shows the result: success, error, or the "check your email" state.
//
// searchParams is a Promise in Next.js v16 — must await it.

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ResendVerificationForm } from "@/components/auth/ResendVerificationForm";

const ERROR_MESSAGES: Record<string, string> = {
  "missing-token": "The verification link is missing a token. Please use the link from your email.",
  "invalid-token": "This verification link is invalid or has already been used.",
  "expired-token": "This verification link has expired. Links are valid for 24 hours.",
};

interface Props {
  searchParams: Promise<{ error?: string }>;
}

export default async function VerifyEmailPage({ searchParams }: Props) {
  const { error } = await searchParams;

  if (!error) {
    // No error = user arrived here after registering, before clicking the link
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Check your email</CardTitle>
            <CardDescription>
              We sent a verification link to your email address. Click it to
              activate your account.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              The link expires in 24 hours. Didn&apos;t get it?
            </p>
            <ResendVerificationForm />
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Verification failed</CardTitle>
          <CardDescription>
            {ERROR_MESSAGES[error] ?? "Something went wrong with your verification link."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Request a new verification link below.
          </p>
          <ResendVerificationForm />
          <a
            href="/login"
            className="flex h-9 w-full items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-accent"
          >
            Back to sign in
          </a>
        </CardContent>
      </Card>
    </main>
  );
}
