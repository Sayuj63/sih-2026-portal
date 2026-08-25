import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma migrations need a *direct* connection (session-mode). At runtime we
// use the pgbouncer-pooled URL. Prefer POSTGRES_URL_NON_POOLING when Vercel's
// Supabase integration has provided it, else fall back to DATABASE_URL.
function migrateUrl(): string {
  const direct = process.env["POSTGRES_URL_NON_POOLING"];
  const generic = process.env["DATABASE_URL"];
  const url = direct || generic || "";
  if (!url) return "";
  // Same self-signed-cert workaround as src/lib/config.ts
  if (url.includes("supabase") || url.includes("pooler")) {
    if (url.includes("sslmode=no-verify")) return url;
    return url.replace(/sslmode=[^&]+/, "sslmode=no-verify");
  }
  return url;
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: migrateUrl(),
  },
});
