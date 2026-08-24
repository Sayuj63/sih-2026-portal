import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, hasRole } from "@/lib/auth-guard";
import { getCollege } from "@/lib/college";
import { audit } from "@/lib/audit";
import { fail, ok } from "@/lib/http";

export async function POST(req: NextRequest, ctx: RouteContext<"/api/admin/teams/[id]/reject">) {
  const admin = await requireAdmin();
  if (!admin) return fail("UNAUTHORIZED", "Not signed in.", { status: 401 });
  if (!hasRole(admin.role, "SPOC_ADMIN")) return fail("FORBIDDEN", "Insufficient role.", { status: 403 });

  const body = await req.json().catch(() => ({}));
  const reason = String(body?.reason ?? "").trim();
  if (reason.length === 0) return fail("REASON_REQUIRED", "A reason is required to reject a team.");

  const { id } = await ctx.params;
  const college = await getCollege();
  const team = await prisma.team.findFirst({ where: { id, collegeId: college.id } });
  if (!team) return fail("NOT_FOUND", "Team not found.", { status: 404 });

  const updated = await prisma.team.update({
    where: { id: team.id },
    data: { status: "REJECTED", version: { increment: 1 } },
  });

  await audit({
    actorType: "ADMIN",
    adminId: admin.id,
    action: "TEAM_REJECTED",
    resource: "Team",
    resourceId: team.id,
    reason,
    before: { status: team.status },
    after: { status: updated.status },
  });

  return ok({ team: { id: updated.id, status: updated.status } });
}
