import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCollege, getRegistrationMode, isWithinRegistrationWindow } from "@/lib/college";
import { requireStudent } from "@/lib/auth-guard";
import { CreateTeamSchema, ValidationError, validateTeamName } from "@/lib/validation";
import { fail, ok } from "@/lib/http";
import { audit } from "@/lib/audit";
import { generateTeamCode } from "@/lib/team-code";
import { getTeamByLeader, getStudentActiveTeam, TEAM_INCLUDE, validateForFinalize, serialize } from "@/lib/team-service";
export { serialize };

export async function GET() {
  const student = await requireStudent();
  if (!student) return fail("UNAUTHORIZED", "Not signed in.", { status: 401 });

  const led = await getTeamByLeader(student.id);
  const membership = await getStudentActiveTeam(student.id);
  const team = led ?? membership;
  if (!team) return ok({ team: null });

  const validation = await validateForFinalize(team.id);
  return ok({ team: serialize(team), validation, isLeader: team.leaderStudentId === student.id });
}

// Create a new team. The authenticated student becomes the leader (§20).
export async function POST(req: NextRequest) {
  const student = await requireStudent();
  if (!student) return fail("UNAUTHORIZED", "Sign in to create a team.", { status: 401 });

  const college = await getCollege();
  const windowResult = isWithinRegistrationWindow();
  if (!windowResult.ok) return fail("WINDOW_CLOSED", windowResult.reason);
  const mode = await getRegistrationMode(college.id);
  if (mode !== "OPEN") return fail("WINDOW_CLOSED", `Registration is currently ${mode}.`);

  const parsed = CreateTeamSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION_ERROR", "Team name and guidelines acknowledgement are required.");
  if (!parsed.data.guidelinesAccepted) return fail("GUIDELINES_REQUIRED", "You must acknowledge the SIH guidelines to continue.");

  let name: { normalized: string; display: string };
  try {
    name = validateTeamName(parsed.data.teamName);
  } catch (e) {
    if (e instanceof ValidationError) return fail("BAD_TEAM_NAME", e.message);
    return fail("BAD_TEAM_NAME", "Invalid team name.");
  }

  // Enforce: leader is not already on any active team, has not already created a non-withdrawn team.
  const existingLed = await prisma.team.findFirst({
    where: { leaderStudentId: student.id, status: { notIn: ["WITHDRAWN"] } },
  });
  if (existingLed) return fail("ALREADY_LEADING", "You already lead a registered team.");

  const existingMembership = await prisma.teamMember.findFirst({
    where: { studentId: student.id, isActive: true },
  });
  if (existingMembership) return fail("ALREADY_ON_TEAM", "You are already on an active team.");

  const teamCode = await generateTeamCode();

  try {
    const created = await prisma.$transaction(async (tx) => {
      const team = await tx.team.create({
        data: {
          collegeId: college.id,
          teamCode,
          teamName: name.display,
          normalizedTeamName: name.normalized,
          leaderStudentId: student.id,
          status: "DRAFT",
          guidelinesAcceptedAt: new Date(),
        },
      });
      await tx.teamMember.create({
        data: {
          teamId: team.id,
          studentId: student.id,
          role: "LEADER",
          isActive: true,
        },
      });
      return team;
    });

    await audit({
      actorType: "STUDENT",
      actorId: student.id,
      action: "TEAM_CREATED",
      resource: "Team",
      resourceId: created.id,
      after: { teamName: name.display, teamCode },
    });

    const fresh = await prisma.team.findUnique({ where: { id: created.id }, include: TEAM_INCLUDE });
    return ok({ team: serialize(fresh!) });
  } catch (e: unknown) {
    const err = e as { code?: string; meta?: { target?: unknown } };
    if (err?.code === "P2002") {
      const target = String(err?.meta?.target ?? "");
      if (target.includes("normalizedTeamName")) {
        return fail("TEAM_NAME_TAKEN", "That team name is already registered.");
      }
      if (target.includes("teamCode")) {
        return fail("SERVER_ERROR", "Please try again.", { status: 500 });
      }
      if (target.includes("studentId") && target.includes("isActive")) {
        return fail("ALREADY_ON_TEAM", "You are already on an active team.");
      }
    }
    throw e;
  }
}

