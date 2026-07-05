// searchParams is a Promise in Next.js v16 — must await before reading.
import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export const metadata = { title: "Reset Password" };

interface Props {
  searchParams: Promise<{ token?: string }>;
}

export default async function ResetPasswordPage({ searchParams }: Props) {
  const { token } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <Suspense>
        <ResetPasswordForm token={token ?? ""} />
      </Suspense>
    </main>
  );
}
