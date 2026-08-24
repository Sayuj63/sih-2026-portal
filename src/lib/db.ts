import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { config } from "./config";

// Serverless (Vercel) filesystems are read-only except /tmp. When we detect that env
// we copy a pre-seeded SQLite file from the deployment into /tmp on first use.
// For local dev the DATABASE_URL path is used as-is.
function sqlitePath(): string {
  const url = config.databaseUrl;
  const raw = url.startsWith("file:") ? url.slice("file:".length) : url;

  if (process.env.VERCEL) {
    const tmp = "/tmp/sih-portal.db";
    if (!fs.existsSync(tmp)) {
      const seed = path.resolve(process.cwd(), "prisma/seed-copy.db");
      if (fs.existsSync(seed)) fs.copyFileSync(seed, tmp);
    }
    return tmp;
  }

  return raw;
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: sqlitePath() }),
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
