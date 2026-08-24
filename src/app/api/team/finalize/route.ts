import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireStudent } from "@/lib/auth-guard";
import { FinalizeSchema } from "@/lib/validation";
import { audit } from "@/lib/audit";
import { fail, ok } from "@/lib/http";
import { TEAM_INCLUDE, validateForFinalize, serialize } from "@/lib/team-service";

// Final registration — the transactional heart of the portal.
// §47 (transaction), §48 (double-click idempotency), §49 (race conditions), §76 (snapshot).
export async function POST(req: NextRequest) {
  const student = await requireStudent();
  if (!student) return fail("UNAUTHORIZED", "Not signed in.", { status: 401 });

  const parsed = FinalizeSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION_ERROR", "Idempotency key is required.");
  const idem = parsed.data.idempotencyKey;

  const team = await prisma.team.findFirst({
    where: { leaderStudentId: student.id, status: { notIn: ["WITHDRAWN"] } },
    include: TEAM_INCLUDE,
  });
  if (!team) return fail("NO_TEAM", "No team ready for finalization.");

  // Idempotency check FIRST — before the locked/status short-circuits. This is what makes
  // "double click FINAL REGISTER" produce one registration (§48).
  if (team.idempotencyKey && team.idempotencyKey === idem && team.submittedAt) {
    return ok({
      team: serialize(team),
      registration: {
        teamCode: team.teamCode,
        registeredAt: team.submittedAt,
      },
      alreadyRegistered: true,
    });
  }

  if (team.lockedAt) return fail("LOCKED", "Team is already registered.");
  if (!["DRAFT", "READY", "CORRECTION_REQUIRED"].includes(team.status)) {
    return fail("BAD_STATE", "Team is not in a state that can be finalized.");
  }

  // Re-run every rule server-side (§46 mirror).
  const validation = await validateForFinalize(team.id);
  if (!validation.ok) {
    return fail("VALIDATION_FAILED", validation.errors.join(" "), { status: 400 });
  }

  // Snapshot payload — the point-in-time roster (§76).
  const snapshotPayload = JSON.stringify({
    teamCode: team.teamCode,
    teamName: team.teamName,
    leader: {
      id: team.leader.id,
      fullName: team.leader.fullName,
      rollNumber: team.leader.rollNumber,
      email: team.leader.collegeEmail,
      cohortAtRegistration: team.leader.cohort.displayName,
      batchYear: team.leader.cohort.batchYear,
      gender: team.leader.gender,
    },
    members: team.members.filter((m) => m.isActive).map((m) => ({
      studentId: m.student.id,
      fullName: m.student.fullName,
      rollNumber: m.student.rollNumber,
      email: m.student.collegeEmail,
      cohortAtRegistration: m.student.cohort.displayName,
      batchYear: m.student.cohort.batchYear,
      gender: m.student.gender,
      role: m.role,
    })),
    ps: team.psAssignments[0]
      ? {
          psNumber: team.psAssignments[0].ps.psNumber,
          title: team.psAssignments[0].ps.title,
          organization: team.psAssignments[0].ps.organization,
          theme: team.psAssignments[0].ps.theme,
          category: team.psAssignments[0].ps.category,
        }
      : null,
    registeredAt: new Date().toISOString(),
  });

  const now = new Date();
  try {
    const committed = await prisma.$transaction(async (tx) => {
      // Optimistic version check — refuses stale updates (§70).
      const locked = await tx.team.updateMany({
        where: { id: team.id, version: team.version, lockedAt: null },
        data: {
          status: "APPROVED",
          submittedAt: now,
          lockedAt: now,
          idempotencyKey: idem,
          version: { increment: 1 },
        },
      });
      if (locked.count === 0) {
        throw new StaleTeamError();
      }
      await tx.teamSnapshot.upsert({
        where: { teamId: team.id },
        update: { payload: snapshotPayload, registeredAt: now },
        create: { teamId: team.id, payload: snapshotPayload, registeredAt: now },
      });
      return tx.team.findUnique({ where: { id: team.id }, include: TEAM_INCLUDE });
    });

    await audit({
      actorType: "STUDENT",
      actorId: student.id,
      action: "TEAM_FINALIZED",
      resource: "Team",
      resourceId: team.id,
      after: { teamCode: team.teamCode, at: now.toISOString() },
    });

    return ok({
      team: serialize(committed!),
      registration: { teamCode: team.teamCode, registeredAt: now },
      alreadyRegistered: false,
    });
  } catch (e) {
    if (e instanceof StaleTeamError) {
      return fail("CONFLICT", "This team was changed elsewhere. Refresh and try again.", { status: 409 });
    }
    throw e;
  }
}

class StaleTeamError extends Error {}
