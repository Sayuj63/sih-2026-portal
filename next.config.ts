import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ensure the pre-seeded SQLite file + Prisma migration folder are traced into
  // serverless function bundles so /tmp copy on cold start actually finds them.
  outputFileTracingIncludes: {
    "/**": ["./prisma/seed-copy.db", "./prisma/migrations/**/*"],
  },
  // Native modules need to be treated as externals in server bundles.
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-better-sqlite3", "better-sqlite3", "@node-rs/argon2"],
};

export default nextConfig;
