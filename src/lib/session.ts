import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import { config } from "./config";

export type StudentSessionData = {
  studentId?: string;
  email?: string;
};

export type AdminSessionData = {
  adminId?: string;
  username?: string;
  role?: "SUPER_ADMIN" | "SPOC_ADMIN" | "REVIEWER" | "READ_ONLY";
};

const baseCookie = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

const studentOptions: SessionOptions = {
  password: config.sessionSecret,
  cookieName: "isu_sih_student_session",
  ttl: 60 * 60 * 8, // 8h
  cookieOptions: baseCookie,
};

const adminOptions: SessionOptions = {
  password: config.sessionSecret,
  cookieName: "isu_sih_admin_session",
  ttl: 60 * 60 * 4, // 4h
  cookieOptions: baseCookie,
};

export async function getStudentSession() {
  return getIronSession<StudentSessionData>(await cookies(), studentOptions);
}

export async function getAdminSession() {
  return getIronSession<AdminSessionData>(await cookies(), adminOptions);
}
