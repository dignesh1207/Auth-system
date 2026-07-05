// Server Component — runs on the server, has direct access to cookies.
// WHY read the session here instead of /api/auth/me?
// A Server Component can call getSessionFromCookie() directly — no HTTP
// round-trip needed. This is faster and keeps private data off the client.

import { redirect } from "next/navigation";
import { getSessionFromCookie } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { LogoutButton } from "@/components/auth/LogoutButton";

export const metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const session = await getSessionFromCookie();

  // Belt-and-suspenders: proxy.ts already redirects unauthenticated users,
  // but we double-check here so this page is safe even if proxy is bypassed.
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });

  if (!user) redirect("/login");

  return (
    <main className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <LogoutButton />
        </div>

        <div className="rounded-lg border bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold">Your Account</h2>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Name</p>
              <p className="font-medium">{user.name ?? "Not set"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Email</p>
              <p className="font-medium">{user.email}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Role</p>
              <p className="font-medium">{user.role}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Member since</p>
              <p className="font-medium">
                {user.createdAt.toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-lg border bg-card p-6">
          <h2 className="text-lg font-semibold mb-2">JWT Payload (dev only)</h2>
          <p className="text-sm text-muted-foreground mb-3">
            This is what lives inside your access token cookie. Notice there&apos;s
            no password hash — only the minimum data needed to identify you.
          </p>
          <pre className="rounded bg-muted p-4 text-xs overflow-auto">
            {JSON.stringify(session, null, 2)}
          </pre>
        </div>
      </div>
    </main>
  );
}
