import { prisma } from "./db";
import { config } from "./config";

let cached: { id: string; name: string; emailDomain: string; timezone: string } | null = null;

export async function getCollege() {
  if (cached) return cached;
  const row = await prisma.college.findUnique({
    where: { slug: config.college.slug },
  });
  if (!row) throw new Error("College not seeded. Run `npx tsx prisma/seed.ts` first.");
  cached = {
    id: row.id,
    name: row.name,
    emailDomain: row.emailDomain,
    timezone: row.timezone,
  };
  return cached;
}

export type RegistrationMode = "OPEN" | "PAUSED" | "CLOSED";

export async function getRegistrationMode(collegeId: string): Promise<RegistrationMode> {
  const row = await prisma.appSetting.findUnique({
    where: { collegeId_key: { collegeId, key: "REGISTRATION_MODE" } },
  });
  const value = row?.value ?? "OPEN";
  if (value === "PAUSED" || value === "CLOSED") return value;
  return "OPEN";
}

export async function setRegistrationMode(collegeId: string, mode: RegistrationMode) {
  await prisma.appSetting.upsert({
    where: { collegeId_key: { collegeId, key: "REGISTRATION_MODE" } },
    update: { value: mode },
    create: { collegeId, key: "REGISTRATION_MODE", value: mode },
  });
}

// Server-time deadline check — never trust the browser clock (spec §83, §107).
export function isWithinRegistrationWindow(now: Date = new Date()): { ok: true } | { ok: false; reason: string } {
  if (now < config.window.openAt) {
    return { ok: false, reason: "Registration has not opened yet." };
  }
  if (now > config.window.closeAt) {
    return { ok: false, reason: "Registration deadline has passed." };
  }
  return { ok: true };
}
