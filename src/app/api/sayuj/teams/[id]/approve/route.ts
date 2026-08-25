import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, hasRole } from "@/lib/auth-guard";
import { getCollege } from "@/lib/college";
import { validateForFinalize } from "@/lib/team-service";
import { audit } from "@/lib/audit";
import { fail, ok } from "@/lib/http";

export async function POST(_req: NextRequest, ctx: RouteContext<"/api/sayuj/teams/[id]/approve">) {
  const admin = await requireAdmin();
  if (!admin) return fail("UNAUTHORIZED", "Not signed in.", { status: 401 });
  if (!hasRole(admin.role, "SPOC_ADMIN")) return fail("FORBIDDEN", "Insufficient role.", { status: 403 });

  const { id } = await ctx.params;
  const college = await getCollege();
  const team = await prisma.team.findFirst({ where: { id, collegeId: college.id } });
  if (!team) return fail("NOT_FOUND", "Team not found.", { status: 404 });

  const validation = await validateForFinalize(team.id);
  if (!validation.ok) {
    return fail("VALIDATION_FAILED", `Cannot approve: ${validation.errors.join(" ")}`);
  }

  const updated = await prisma.team.update({
    where: { id: team.id },
    data: {
      status: "APPROVED",
      submittedAt: team.submittedAt ?? new Date(),
      lockedAt: team.lockedAt ?? new Date(),
      version: { increment: 1 },
    },
  });

  await audit({
    actorType: "ADMIN",
    adminId: admin.id,
    action: "TEAM_APPROVED",
    resource: "Team",
    resourceId: team.id,
    before: { status: team.status },
    after: { status: updated.status },
  });

  return ok({ team: { id: updated.id, status: updated.status } });
}
