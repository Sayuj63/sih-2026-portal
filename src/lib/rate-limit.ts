import { prisma } from "./db";

// Fixed-window rate limiter backed by RateLimitBucket. Simple and correct enough for a college
// portal. Combine bucket keys with account/email + IP for the login/OTP surfaces (spec §60).
export async function checkRateLimit(opts: {
  key: string;
  max: number;
  windowSec: number;
}): Promise<{ allowed: boolean; remaining: number; retryAfterMs: number }> {
  const now = new Date();
  const bucket = await prisma.rateLimitBucket.upsert({
    where: { bucketKey: opts.key },
    update: {},
    create: { bucketKey: opts.key, count: 0, windowStart: now },
  });

  const windowMs = opts.windowSec * 1000;
  const elapsed = now.getTime() - bucket.windowStart.getTime();

  if (elapsed >= windowMs) {
    // Reset window
    const reset = await prisma.rateLimitBucket.update({
      where: { bucketKey: opts.key },
      data: { count: 1, windowStart: now },
    });
    return { allowed: true, remaining: opts.max - reset.count, retryAfterMs: 0 };
  }

  if (bucket.count + 1 > opts.max) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: windowMs - elapsed,
    };
  }

  await prisma.rateLimitBucket.update({
    where: { bucketKey: opts.key },
    data: { count: { increment: 1 } },
  });
  return { allowed: true, remaining: opts.max - (bucket.count + 1), retryAfterMs: 0 };
}

export function clientIp(req: Request): string {
  const h = req.headers;
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    "unknown"
  );
}
