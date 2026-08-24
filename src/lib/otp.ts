import crypto from "node:crypto";
import { prisma } from "./db";
import { config } from "./config";

function generateOtp(): string {
  const n = crypto.randomInt(0, 10 ** config.otp.length);
  return n.toString().padStart(config.otp.length, "0");
}

function hashOtp(otp: string, email: string): string {
  return crypto
    .createHmac("sha256", config.otpPepper)
    .update(`${email.toLowerCase()}|${otp}`)
    .digest("hex");
}

export async function issueOtp(email: string): Promise<{ otp: string; expiresAt: Date }> {
  const otp = generateOtp();
  const otpHash = hashOtp(otp, email);
  const expiresAt = new Date(Date.now() + config.otp.ttlSec * 1000);

  // Invalidate any active challenges for this email — one-at-a-time.
  await prisma.otpChallenge.updateMany({
    where: { email, isConsumed: false },
    data: { isConsumed: true },
  });

  await prisma.otpChallenge.create({
    data: { email, otpHash, expiresAt },
  });

  return { otp, expiresAt };
}

export async function verifyOtp(email: string, otp: string): Promise<
  | { ok: true }
  | { ok: false; reason: "NOT_FOUND" | "EXPIRED" | "TOO_MANY_ATTEMPTS" | "MISMATCH" }
> {
  const challenge = await prisma.otpChallenge.findFirst({
    where: { email, isConsumed: false },
    orderBy: { createdAt: "desc" },
  });
  if (!challenge) return { ok: false, reason: "NOT_FOUND" };

  if (challenge.expiresAt.getTime() <= Date.now()) {
    await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { isConsumed: true },
    });
    return { ok: false, reason: "EXPIRED" };
  }

  if (challenge.attempts >= config.otp.maxAttempts) {
    await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { isConsumed: true },
    });
    return { ok: false, reason: "TOO_MANY_ATTEMPTS" };
  }

  const attempted = hashOtp(otp, email);
  // Constant-time compare
  const a = Buffer.from(attempted, "hex");
  const b = Buffer.from(challenge.otpHash, "hex");
  const equal = a.length === b.length && crypto.timingSafeEqual(a, b);

  if (!equal) {
    await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false, reason: "MISMATCH" };
  }

  await prisma.otpChallenge.update({
    where: { id: challenge.id },
    data: { isConsumed: true },
  });
  return { ok: true };
}
