import { NextRequest } from "next/server";
import { requireAdmin, hasRole } from "@/lib/auth-guard";
import { getCollege, setRegistrationMode } from "@/lib/college";
import { audit } from "@/lib/audit";
import { fail, ok } from "@/lib/http";

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return fail("UNAUTHORIZED", "Not signed in.", { status: 401 });
  if (!hasRole(admin.role, "SUPER_ADMIN")) return fail("FORBIDDEN", "Only super admins can change registration mode.", { status: 403 });

  const body = await req.json().catch(() => ({}));
  const mode = String(body?.mode ?? "");
  if (!["OPEN", "PAUSED", "CLOSED"].includes(mode)) return fail("VALIDATION_ERROR", "Invalid mode.");

  const college = await getCollege();
  await setRegistrationMode(college.id, mode as "OPEN" | "PAUSED" | "CLOSED");

  await audit({
    actorType: "ADMIN",
    adminId: admin.id,
    action: "SETTINGS_MODE_CHANGED",
    resource: "AppSetting",
    resourceId: "REGISTRATION_MODE",
    after: { mode },
  });

  return ok({ mode });
}
