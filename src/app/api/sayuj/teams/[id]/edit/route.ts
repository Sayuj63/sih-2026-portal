import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin, hasRole } from "@/lib/auth-guard";
import { getCollege } from "@/lib/college";
import { audit } from "@/lib/audit";
import { fail, ok } from "@/lib/http";
import {
  GENDER_VALUES,
  normalizeName,
  normalizePsNumber,
  normalizeRollNumber,
  requireCollegeEmail,
  validateTeamName,
  ValidationError,
} from "@/lib/validation";

const MemberSchema = z.object({
  teamMemberId: z.string().min(1),
  studentId: z.string().min(1),
  fullName: z.string().min(1).max(120),
  rollNumber: z.string().min(1).max(32),
  cohortId: z.string().min(1),
  gender: z.enum(GENDER_VALUES),
  branch: z.string().min(1).max(80),
  section: z.string().max(16).nullable().optional(),
  mobileNumber: z.string().max(20).nullable().optional(),
  collegeEmail: z.string().min(3).max(120),
});

const EditTeamSchema = z.object({
  team: z.object({
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
  }),
  members: z.array(MemberSchema).min(1).max(12),
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
    include: {
      psAssignments: { include: { ps: true } },
      members: {
        where: { isActive: true },
        include: { student: { include: { cohort: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!team) return fail("NOT_FOUND", "Team not found.", { status: 404 });

  const activeMembersById = new Map(team.members.map((m) => [m.id, m]));
  for (const m of input.members) {
    if (!activeMembersById.has(m.teamMemberId)) {
      return fail("VALIDATION_ERROR", `Member ${m.teamMemberId} does not belong to this team.`);
    }
  }
  if (input.members.length !== team.members.length) {
    return fail("VALIDATION_ERROR", `Expected ${team.members.length} member rows, got ${input.members.length}.`);
  }

  let nameFields: { teamName: string; normalizedTeamName: string };
  try {
    const { display, normalized } = validateTeamName(input.team.teamName);
    nameFields = { teamName: display, normalizedTeamName: normalized };
  } catch (e) {
    if (e instanceof ValidationError) return fail("VALIDATION_ERROR", e.message);
    throw e;
  }

  const teamCode = input.team.teamCode.trim();

  const currentPs = team.psAssignments[0]?.ps ?? null;
  const trimmedPsNumber = input.team.psNumber.trim();
  let targetPsId: string | null = null;
  let targetPsNumber: string | null = null;
  let normalizedPs: string | null = null;
  if (trimmedPsNumber) {
    try {
      normalizedPs = normalizePsNumber(trimmedPsNumber);
    } catch (e) {
      if (e instanceof ValidationError) return fail("VALIDATION_ERROR", e.message);
      throw e;
    }
    const ps = await prisma.problemStatement.findUnique({
      where: { collegeId_normalizedPsNumber: { collegeId: college.id, normalizedPsNumber: normalizedPs } },
    });
    if (ps) {
      targetPsId = ps.id;
      targetPsNumber = ps.psNumber;
    } else {
      targetPsNumber = trimmedPsNumber;
    }
  }

  const validCohortIds = new Set(
    (
      await prisma.cohort.findMany({
        where: { collegeId: college.id, id: { in: input.members.map((m) => m.cohortId) } },
        select: { id: true },
      })
    ).map((c) => c.id),
  );

  type MemberUpdate = {
    teamMember: NonNullable<typeof team.members[number]>;
    label: string;
    fullName: string;
    normalizedName: string;
    rollNumber: string;
    normalizedRollNumber: string;
    cohortId: string;
    gender: string;
    branch: string;
    section: string | null;
    mobileNumber: string | null;
    collegeEmail: string;
    normalizedEmail: string;
  };

  const updates: MemberUpdate[] = [];
  const seenEmails = new Set<string>();
  const seenCohortRoll = new Set<string>();

  for (const m of input.members) {
    const label = `Member ${m.fullName || m.teamMemberId.slice(0, 6)}`;
    const teamMember = activeMembersById.get(m.teamMemberId)!;

    if (!validCohortIds.has(m.cohortId)) {
      return fail("VALIDATION_ERROR", `${label}: cohort not found.`);
    }

    let normalizedEmail: string;
    let displayEmail: string;
    try {
      normalizedEmail = requireCollegeEmail(m.collegeEmail);
      displayEmail = m.collegeEmail.trim();
    } catch (e) {
      if (e instanceof ValidationError) return fail("VALIDATION_ERROR", `${label}: ${e.message}`);
      throw e;
    }

    let normalizedRoll: string;
    try {
      normalizedRoll = normalizeRollNumber(m.rollNumber);
    } catch (e) {
      if (e instanceof ValidationError) return fail("VALIDATION_ERROR", `${label}: ${e.message}`);
      throw e;
    }

    if (seenEmails.has(normalizedEmail)) {
      return fail("VALIDATION_ERROR", `${label}: duplicate email in this team.`);
    }
    seenEmails.add(normalizedEmail);

    const rollKey = `${m.cohortId}::${normalizedRoll}`;
    if (seenCohortRoll.has(rollKey)) {
      return fail("VALIDATION_ERROR", `${label}: duplicate roll number in cohort within this team.`);
    }
    seenCohortRoll.add(rollKey);

    updates.push({
      teamMember,
      label,
      fullName: m.fullName.trim(),
      normalizedName: normalizeName(m.fullName),
      rollNumber: normalizedRoll,
      normalizedRollNumber: normalizedRoll,
      cohortId: m.cohortId,
      gender: m.gender,
      branch: m.branch.trim(),
      section: m.section?.trim() ? m.section.trim() : null,
      mobileNumber: m.mobileNumber?.trim() ? m.mobileNumber.trim() : null,
      collegeEmail: displayEmail,
      normalizedEmail,
    });
  }

  const before = {
    team: {
      teamName: team.teamName,
      teamCode: team.teamCode,
      status: team.status,
      psNumber: currentPs?.psNumber ?? null,
    },
    members: team.members.map((m) => ({
      studentId: m.studentId,
      fullName: m.student.fullName,
      rollNumber: m.student.rollNumber,
      cohortId: m.student.cohortId,
      gender: m.student.gender,
      branch: m.student.branch,
      section: m.student.section,
      mobileNumber: m.student.mobileNumber,
      collegeEmail: m.student.collegeEmail,
    })),
  };
  const after = {
    team: {
      teamName: nameFields.teamName,
      teamCode,
      status: input.team.status,
      psNumber: targetPsNumber,
    },
    members: updates.map((u) => ({
      studentId: u.teamMember.studentId,
      fullName: u.fullName,
      rollNumber: u.rollNumber,
      cohortId: u.cohortId,
      gender: u.gender,
      branch: u.branch,
      section: u.section,
      mobileNumber: u.mobileNumber,
      collegeEmail: u.collegeEmail,
    })),
  };

  try {
    await prisma.$transaction(async (tx) => {
      await tx.team.update({
        where: { id: team.id },
        data: {
          teamName: nameFields.teamName,
          normalizedTeamName: nameFields.normalizedTeamName,
          teamCode,
          status: input.team.status,
          version: { increment: 1 },
        },
      });

      let resolvedPsId: string | null = targetPsId;
      if (!resolvedPsId && normalizedPs && trimmedPsNumber) {
        const created = await tx.problemStatement.upsert({
          where: {
            collegeId_normalizedPsNumber: { collegeId: college.id, normalizedPsNumber: normalizedPs },
          },
          update: {},
          create: {
            collegeId: college.id,
            psNumber: trimmedPsNumber,
            normalizedPsNumber: normalizedPs,
            title: `Problem Statement ${trimmedPsNumber}`,
            organization: "Admin-added by SPOC",
            theme: "Not specified",
            category: "Not specified",
            description: "Admin-supplied problem statement — verify against the official SIH portal.",
          },
        });
        resolvedPsId = created.id;
        targetPsNumber = created.psNumber;
      }

      if (resolvedPsId !== (currentPs?.id ?? null)) {
        await tx.teamProblemStatement.deleteMany({ where: { teamId: team.id } });
        if (resolvedPsId) {
          await tx.teamProblemStatement.create({
            data: { teamId: team.id, psId: resolvedPsId },
          });
        }
      }

      for (const u of updates) {
        await tx.student.update({
          where: { id: u.teamMember.studentId },
          data: {
            fullName: u.fullName,
            normalizedName: u.normalizedName,
            rollNumber: u.rollNumber,
            normalizedRollNumber: u.normalizedRollNumber,
            cohortId: u.cohortId,
            gender: u.gender,
            branch: u.branch,
            section: u.section,
            mobileNumber: u.mobileNumber,
            collegeEmail: u.collegeEmail,
            normalizedEmail: u.normalizedEmail,
          },
        });
      }
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Unique constraint")) {
      return fail(
        "CONFLICT",
        "A uniqueness rule was hit — likely a duplicate team name/code, or a student email or roll+cohort that already exists in the master directory.",
      );
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
