import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin, hasRole } from "@/lib/auth-guard";
import { getCollege, getRegistrationWindow, setRegistrationWindow } from "@/lib/college";
import { audit } from "@/lib/audit";
import { fail, ok } from "@/lib/http";

const BodySchema = z.object({
  openAt: z.string().min(1),
  closeAt: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return fail("UNAUTHORIZED", "Not signed in.", { status: 401 });
  if (!hasRole(admin.role, "SUPER_ADMIN")) {
    return fail("FORBIDDEN", "Only super admins can change the registration window.", { status: 403 });
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION_ERROR", "openAt and closeAt are required.");

  const openAt = new Date(parsed.data.openAt);
  const closeAt = new Date(parsed.data.closeAt);
  if (isNaN(openAt.getTime()) || isNaN(closeAt.getTime())) {
    return fail("VALIDATION_ERROR", "Invalid date value.");
  }
  if (openAt >= closeAt) {
    return fail("VALIDATION_ERROR", "Opens must be before Closes.");
  }

  const college = await getCollege();
  const before = await getRegistrationWindow(college.id);
  await setRegistrationWindow(college.id, openAt, closeAt);

  await audit({
    actorType: "ADMIN",
    adminId: admin.id,
    action: "SETTINGS_WINDOW_CHANGED",
    resource: "AppSetting",
    resourceId: "REGISTRATION_WINDOW",
    before: { openAt: before.openAt.toISOString(), closeAt: before.closeAt.toISOString() },
    after: { openAt: openAt.toISOString(), closeAt: closeAt.toISOString() },
  });

  return ok({ openAt: openAt.toISOString(), closeAt: closeAt.toISOString() });
}
