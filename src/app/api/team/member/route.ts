import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireStudent } from "@/lib/auth-guard";
import { AddMemberSchema, ValidationError, normalizeRollNumber } from "@/lib/validation";
import { audit } from "@/lib/audit";
import { fail, ok } from "@/lib/http";
import { getCollege, getRegistrationMode, isWithinRegistrationWindow } from "@/lib/college";
import { config } from "@/lib/config";
import { getTeamByLeader, serialize } from "@/lib/team-service";

async function loadLeaderTeam(studentId: string) {
  return prisma.team.findFirst({
    where: { leaderStudentId: studentId, status: { in: ["DRAFT", "READY", "CORRECTION_REQUIRED"] } },
  });
}

// Add a member. Server enforces the whole rule set — the browser can be lied to.
export async function POST(req: NextRequest) {
  const student = await requireStudent();
  if (!student) return fail("UNAUTHORIZED", "Not signed in.", { status: 401 });

  const parsed = AddMemberSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION_ERROR", "Cohort and roll number are required.");

  const college = await getCollege();
  const windowResult = isWithinRegistrationWindow();
  if (!windowResult.ok) return fail("WINDOW_CLOSED", windowResult.reason);
  const mode = await getRegistrationMode(college.id);
  if (mode !== "OPEN") return fail("WINDOW_CLOSED", `Registration is currently ${mode}.`);

  const team = await loadLeaderTeam(student.id);
  if (!team) return fail("NO_TEAM", "Only a team leader can add members. Create a team first.");
  if (team.lockedAt) return fail("LOCKED", "Team is locked. Contact the SPOC to unlock.");

  let normalizedRoll: string;
  try {
    normalizedRoll = normalizeRollNumber(parsed.data.rollNumber);
  } catch (e) {
    if (e instanceof ValidationError) return fail("BAD_ROLL", e.message);
    return fail("BAD_ROLL", "Invalid roll number.");
  }

  const cohort = await prisma.cohort.findFirst({
    where: { id: parsed.data.cohortId, collegeId: college.id, isActive: true },
  });
  if (!cohort) return fail("NOT_FOUND", "Student not found. Please verify cohort and roll number.", { status: 404 });

  const candidate = await prisma.student.findUnique({
    where: {
      cohortId_normalizedRollNumber: { cohortId: cohort.id, normalizedRollNumber: normalizedRoll },
    },
  });
  if (!candidate || !candidate.isActive || candidate.collegeId !== college.id) {
    return fail("NOT_FOUND", "Student not found. Please verify cohort and roll number.", { status: 404 });
  }
  if (!candidate.normalizedEmail.endsWith(`@${college.emailDomain}`)) {
    return fail("BAD_EMAIL", `Student's email is not @${college.emailDomain}.`);
  }

  // Do the add inside a transaction. The @@unique([studentId, isActive]) constraint on TeamMember
  // is what makes "one active team per student" race-safe (§18, §49).
  try {
    const before = await prisma.teamMember.findMany({
      where: { teamId: team.id, isActive: true },
      select: { studentId: true },
    });
    if (before.length >= config.team.size) {
      return fail("TEAM_FULL", `Team already has ${config.team.size} members.`);
    }
    if (before.some((m) => m.studentId === candidate.id)) {
      return fail("DUPLICATE_MEMBER", "This student is already on your team.");
    }

    await prisma.teamMember.create({
      data: {
        teamId: team.id,
        studentId: candidate.id,
        role: "MEMBER",
        isActive: true,
      },
    });

    await audit({
      actorType: "STUDENT",
      actorId: student.id,
      action: "MEMBER_ADDED",
      resource: "Team",
      resourceId: team.id,
      after: { studentId: candidate.id },
    });
  } catch (e: unknown) {
    const err = e as { code?: string; meta?: { target?: unknown } };
    if (err?.code === "P2002") {
      const target = String(err?.meta?.target ?? "");
      if (target.includes("studentId") && target.includes("isActive")) {
        return fail("ALREADY_ON_TEAM", "This student is already assigned to an active team.");
      }
      if (target.includes("teamId") && target.includes("studentId")) {
        return fail("DUPLICATE_MEMBER", "This student is already on your team.");
      }
    }
    throw e;
  }

  const fresh = await getTeamByLeader(student.id);
  return ok({ team: serialize(fresh!) });
}

// Remove a member. Cannot remove the leader (spec §75).
export async function DELETE(req: NextRequest) {
  const student = await requireStudent();
  if (!student) return fail("UNAUTHORIZED", "Not signed in.", { status: 401 });

  const url = new URL(req.url);
  const memberId = url.searchParams.get("memberId");
  if (!memberId) return fail("VALIDATION_ERROR", "memberId is required.");

  const team = await loadLeaderTeam(student.id);
  if (!team) return fail("NO_TEAM", "Only a team leader can modify members.");
  if (team.lockedAt) return fail("LOCKED", "Team is locked.");

  const member = await prisma.teamMember.findUnique({ where: { id: memberId } });
  if (!member || member.teamId !== team.id) return fail("NOT_FOUND", "Member not found.", { status: 404 });
  if (member.role === "LEADER") return fail("CANNOT_REMOVE_LEADER", "The team leader cannot be removed here.");

  await prisma.teamMember.delete({ where: { id: memberId } });

  await audit({
    actorType: "STUDENT",
    actorId: student.id,
    action: "MEMBER_REMOVED",
    resource: "Team",
    resourceId: team.id,
    before: { studentId: member.studentId },
  });

  const fresh = await getTeamByLeader(student.id);
  return ok({ team: serialize(fresh!) });
}
