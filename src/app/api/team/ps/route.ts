import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireStudent } from "@/lib/auth-guard";
import { AssignPsSchema } from "@/lib/validation";
import { audit } from "@/lib/audit";
import { fail, ok } from "@/lib/http";
import { getCollege } from "@/lib/college";
import { getTeamByLeader, serialize } from "@/lib/team-service";

export async function POST(req: NextRequest) {
  const student = await requireStudent();
  if (!student) return fail("UNAUTHORIZED", "Not signed in.", { status: 401 });

  const parsed = AssignPsSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION_ERROR", "PS is required.");

  const team = await prisma.team.findFirst({
    where: { leaderStudentId: student.id, status: { in: ["DRAFT", "READY", "CORRECTION_REQUIRED"] } },
  });
  if (!team) return fail("NO_TEAM", "Create a team first.");
  if (team.lockedAt) return fail("LOCKED", "Team is locked.");

  const college = await getCollege();
  const ps = await prisma.problemStatement.findFirst({
    where: { id: parsed.data.psId, collegeId: college.id, status: "ACTIVE" },
  });
  if (!ps) return fail("NOT_FOUND", "Problem Statement not found or inactive.", { status: 404 });

  await prisma.$transaction([
    prisma.teamProblemStatement.deleteMany({ where: { teamId: team.id } }),
    prisma.teamProblemStatement.create({ data: { teamId: team.id, psId: ps.id } }),
  ]);

  await audit({
    actorType: "STUDENT",
    actorId: student.id,
    action: "PS_SELECTED",
    resource: "Team",
    resourceId: team.id,
    after: { psId: ps.id, psNumber: ps.psNumber },
  });

  const fresh = await getTeamByLeader(student.id);
  return ok({ team: serialize(fresh!) });
}
