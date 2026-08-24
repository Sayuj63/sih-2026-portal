import { prisma } from "./db";

export type ActorType = "STUDENT" | "ADMIN" | "SYSTEM";

export async function audit(input: {
  actorType: ActorType;
  actorId?: string | null;
  adminId?: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  requestId?: string | null;
  reason?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
  userAgent?: string | null;
}) {
  await prisma.auditLog.create({
    data: {
      actorType: input.actorType,
      actorId: input.actorId ?? null,
      adminId: input.adminId ?? null,
      action: input.action,
      resource: input.resource,
      resourceId: input.resourceId ?? null,
      requestId: input.requestId ?? null,
      reason: input.reason ?? null,
      before: input.before !== undefined ? JSON.stringify(input.before) : null,
      after: input.after !== undefined ? JSON.stringify(input.after) : null,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
}
