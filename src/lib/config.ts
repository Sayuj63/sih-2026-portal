// Runtime configuration. Every rule value is server-authoritative — do not read these on the client.
// Spec §112 (configurable), §106 (deadlines), §11 (email domain).

function req(key: string): string {
  const v = process.env[key];
  if (!v || v.length === 0) throw new Error(`Missing required env var: ${key}`);
  return v;
}

function opt(key: string, fallback: string): string {
  const v = process.env[key];
  return v && v.length > 0 ? v : fallback;
}

export const config = {
  databaseUrl: req("DATABASE_URL"),
  sessionSecret: req("SESSION_SECRET"),
  otpPepper: req("OTP_PEPPER"),

  college: {
    slug: opt("COLLEGE_SLUG", "isu"),
    name: opt("COLLEGE_NAME", "ISU"),
    emailDomain: opt("COLLEGE_EMAIL_DOMAIN", "isu.ac.in").toLowerCase(),
    timezone: opt("TIMEZONE", "Asia/Kolkata"),
  },

  team: {
    size: Number(opt("TEAM_SIZE", "6")),
    minFemaleMembers: Number(opt("MIN_FEMALE_MEMBERS", "1")),
  },

  window: {
    openAt: new Date(opt("REGISTRATION_OPEN_AT", "2026-06-01T00:00:00+05:30")),
    closeAt: new Date(opt("REGISTRATION_CLOSE_AT", "2026-08-31T23:59:59+05:30")),
  },

  otp: {
    ttlSec: 10 * 60,
    length: 6,
    maxAttempts: 5,
    resendCooldownSec: 60,
    devEcho: opt("DEV_ECHO_OTP", "true") === "true",
  },

  smtp: {
    url: opt("SMTP_URL", ""),
    from: opt("SMTP_FROM", "SIH Registration <no-reply@isu.ac.in>"),
  },
} as const;

export type AppConfig = typeof config;
