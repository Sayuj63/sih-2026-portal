import { prisma } from "./db";
import { getStudentSession, getAdminSession } from "./session";

export async function requireStudent() {
  const session = await getStudentSession();
  if (!session.studentId) return null;
  const student = await prisma.student.findUnique({
    where: { id: session.studentId },
    include: { cohort: true },
  });
  if (!student || !student.isActive) {
    session.destroy();
    return null;
  }
  return student;
}

export async function requireAdmin() {
  const session = await getAdminSession();
  if (!session.adminId) return null;
  const admin = await prisma.admin.findUnique({ where: { id: session.adminId } });
  if (!admin || !admin.isActive) {
    session.destroy();
    return null;
  }
  return admin;
}

export type AdminRole = "SUPER_ADMIN" | "SPOC_ADMIN" | "REVIEWER" | "READ_ONLY";
const ORDER: Record<AdminRole, number> = {
  SUPER_ADMIN: 4,
  SPOC_ADMIN: 3,
  REVIEWER: 2,
  READ_ONLY: 1,
};

export function hasRole(adminRole: string, atLeast: AdminRole): boolean {
  return (ORDER[adminRole as AdminRole] ?? 0) >= ORDER[atLeast];
}

