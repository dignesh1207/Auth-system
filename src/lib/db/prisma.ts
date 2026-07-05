// Prisma Client singleton with driver adapter.
//
// WHY a singleton? Next.js hot-reloads in development, which would create a
// new PrismaClient + connection pool on every reload. We attach the instance
// to `globalThis` in dev so it survives hot-reloads.
//
// WHY a driver adapter? Prisma v6 uses an explicit adapter layer between the
// ORM and the database driver. For PostgreSQL, @prisma/adapter-pg wraps the
// `pg` package. This separation lets Prisma run in edge runtimes (Cloudflare
// Workers, Vercel Edge) where native binaries aren't available.

import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  // Pool handles connection reuse. max:10 is sensible for a web app;
  // lower it if you're on a serverless platform with many instances.
  const pool = new Pool({ connectionString, max: 10 });
  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
