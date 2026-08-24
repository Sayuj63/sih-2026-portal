import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { config } from "./config";

// SQLite path from DATABASE_URL="file:./dev.db"
function sqlitePath(): string {
  const url = config.databaseUrl;
  return url.startsWith("file:") ? url.slice("file:".length) : url;
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
