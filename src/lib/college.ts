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

export type RegistrationWindow = { openAt: Date; closeAt: Date };

// Reads the window from AppSetting; falls back to the env-derived defaults in config.
export async function getRegistrationWindow(collegeId: string): Promise<RegistrationWindow> {
  const rows = await prisma.appSetting.findMany({
    where: { collegeId, key: { in: ["REGISTRATION_OPEN_AT", "REGISTRATION_CLOSE_AT"] } },
  });
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  const openRaw = byKey.get("REGISTRATION_OPEN_AT");
  const closeRaw = byKey.get("REGISTRATION_CLOSE_AT");
  const openAt = openRaw ? new Date(openRaw) : config.window.openAt;
  const closeAt = closeRaw ? new Date(closeRaw) : config.window.closeAt;
  return {
    openAt: isNaN(openAt.getTime()) ? config.window.openAt : openAt,
    closeAt: isNaN(closeAt.getTime()) ? config.window.closeAt : closeAt,
  };
}

export async function setRegistrationWindow(collegeId: string, openAt: Date, closeAt: Date) {
  await prisma.$transaction([
    prisma.appSetting.upsert({
      where: { collegeId_key: { collegeId, key: "REGISTRATION_OPEN_AT" } },
      update: { value: openAt.toISOString() },
      create: { collegeId, key: "REGISTRATION_OPEN_AT", value: openAt.toISOString() },
    }),
    prisma.appSetting.upsert({
      where: { collegeId_key: { collegeId, key: "REGISTRATION_CLOSE_AT" } },
      update: { value: closeAt.toISOString() },
      create: { collegeId, key: "REGISTRATION_CLOSE_AT", value: closeAt.toISOString() },
    }),
  ]);
}

// Server-time deadline check — never trust the browser clock (spec §83, §107).
export async function isWithinRegistrationWindow(
  collegeId: string,
  now: Date = new Date(),
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const { openAt, closeAt } = await getRegistrationWindow(collegeId);
  if (now < openAt) {
    return { ok: false, reason: "Registration has not opened yet." };
  }
  if (now > closeAt) {
    return { ok: false, reason: "Registration deadline has passed." };
  }
  return { ok: true };
}
