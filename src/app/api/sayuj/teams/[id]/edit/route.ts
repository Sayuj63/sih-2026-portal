import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin, hasRole } from "@/lib/auth-guard";
import { getCollege } from "@/lib/college";
import { audit } from "@/lib/audit";
import { fail, ok } from "@/lib/http";
import { normalizePsNumber, validateTeamName, ValidationError } from "@/lib/validation";

const EditTeamSchema = z.object({
  teamName: z.string().min(3).max(60),
  teamCode: z.string().min(3).max(32),
  status: z.enum([
    "DRAFT",
    "READY",
    "SUBMITTED",
    "APPROVED",
    "REJECTED",
    "LOCKED",
    "CORRECTION_REQUIRED",
    "WITHDRAWN",
  ]),
  psNumber: z.string().max(32).optional().default(""),
  reason: z.string().max(500).optional(),
});

export async function POST(req: NextRequest, ctx: RouteContext<"/api/sayuj/teams/[id]/edit">) {
  const admin = await requireAdmin();
  if (!admin) return fail("UNAUTHORIZED", "Not signed in.", { status: 401 });
  if (!hasRole(admin.role, "SPOC_ADMIN")) return fail("FORBIDDEN", "Insufficient role.", { status: 403 });

  const { id } = await ctx.params;
  const college = await getCollege();

  const raw = await req.json().catch(() => null);
  const parsed = EditTeamSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const input = parsed.data;

  const team = await prisma.team.findFirst({
    where: { id, collegeId: college.id },
    include: { psAssignments: { include: { ps: true } } },
  });
  if (!team) return fail("NOT_FOUND", "Team not found.", { status: 404 });

  let nameFields: { teamName: string; normalizedTeamName: string };
  try {
    const { display, normalized } = validateTeamName(input.teamName);
    nameFields = { teamName: display, normalizedTeamName: normalized };
  } catch (e) {
    if (e instanceof ValidationError) return fail("VALIDATION_ERROR", e.message);
    throw e;
  }

  const teamCode = input.teamCode.trim();

  const currentPs = team.psAssignments[0]?.ps ?? null;
  const trimmedPsNumber = input.psNumber.trim();
  let targetPsId: string | null = null;
  let targetPsNumber: string | null = null;
  if (trimmedPsNumber) {
    let normalizedPs: string;
    try {
      normalizedPs = normalizePsNumber(trimmedPsNumber);
    } catch (e) {
      if (e instanceof ValidationError) return fail("VALIDATION_ERROR", e.message);
      throw e;
    }
    const ps = await prisma.problemStatement.findUnique({
      where: { collegeId_normalizedPsNumber: { collegeId: college.id, normalizedPsNumber: normalizedPs } },
    });
    if (!ps) return fail("PS_NOT_FOUND", `Problem statement ${trimmedPsNumber} does not exist.`);
    targetPsId = ps.id;
    targetPsNumber = ps.psNumber;
  }

  const before = {
    teamName: team.teamName,
    teamCode: team.teamCode,
    status: team.status,
    psNumber: currentPs?.psNumber ?? null,
  };
  const after = {
    teamName: nameFields.teamName,
    teamCode,
    status: input.status,
    psNumber: targetPsNumber,
  };

  try {
    await prisma.$transaction(async (tx) => {
      await tx.team.update({
        where: { id: team.id },
        data: {
          teamName: nameFields.teamName,
          normalizedTeamName: nameFields.normalizedTeamName,
          teamCode,
          status: input.status,
          version: { increment: 1 },
        },
      });

      if (targetPsId !== (currentPs?.id ?? null)) {
        await tx.teamProblemStatement.deleteMany({ where: { teamId: team.id } });
        if (targetPsId) {
          await tx.teamProblemStatement.create({
            data: { teamId: team.id, psId: targetPsId },
          });
        }
      }
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Unique constraint")) {
      return fail("CONFLICT", "Team name or team code already in use.");
    }
    throw e;
  }

  await audit({
    actorType: "ADMIN",
    adminId: admin.id,
    action: "TEAM_EDITED",
    resource: "Team",
    resourceId: team.id,
    reason: input.reason?.trim() || null,
    before,
    after,
  });

  return ok({ team: { id: team.id } });
}
