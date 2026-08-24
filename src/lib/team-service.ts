import { prisma } from "./db";
import { config } from "./config";
import { getCollege, getRegistrationMode, isWithinRegistrationWindow } from "./college";

export const TEAM_INCLUDE = {
  leader: { include: { cohort: true } },
  members: { include: { student: { include: { cohort: true } } }, orderBy: { createdAt: "asc" as const } },
  psAssignments: { include: { ps: true } },
} as const;

type TeamWithIncludes = NonNullable<Awaited<ReturnType<typeof getTeamByLeader>>>;

export function serialize(team: TeamWithIncludes) {
  return {
    id: team.id,
    teamCode: team.teamCode,
    teamName: team.teamName,
    status: team.status,
    guidelinesAcceptedAt: team.guidelinesAcceptedAt,
    submittedAt: team.submittedAt,
    lockedAt: team.lockedAt,
    version: team.version,
    leader: {
      id: team.leader.id,
      fullName: team.leader.fullName,
      rollNumber: team.leader.rollNumber,
      branch: team.leader.branch,
      gender: team.leader.gender,
      cohort: { id: team.leader.cohortId, displayName: team.leader.cohort.displayName, batchYear: team.leader.cohort.batchYear },
    },
    members: team.members
      .filter((m) => m.isActive)
      .map((m) => ({
        id: m.id,
        role: m.role,
        student: {
          id: m.student.id,
          fullName: m.student.fullName,
          rollNumber: m.student.rollNumber,
          branch: m.student.branch,
          gender: m.student.gender,
          email: m.student.collegeEmail,
          cohort: { id: m.student.cohortId, displayName: m.student.cohort.displayName, batchYear: m.student.cohort.batchYear },
        },
      })),
    ps: team.psAssignments[0]
      ? {
          id: team.psAssignments[0].ps.id,
          psNumber: team.psAssignments[0].ps.psNumber,
          title: team.psAssignments[0].ps.title,
          organization: team.psAssignments[0].ps.organization,
          theme: team.psAssignments[0].ps.theme,
          category: team.psAssignments[0].ps.category,
        }
      : null,
  };
}

export type FullTeam = Awaited<ReturnType<typeof getTeamByLeader>>;

export async function getTeamByLeader(studentId: string) {
  return prisma.team.findFirst({
    where: { leaderStudentId: studentId, status: { notIn: ["WITHDRAWN"] } },
    include: TEAM_INCLUDE,
  });
}

export async function getStudentActiveTeam(studentId: string) {
  const membership = await prisma.teamMember.findFirst({
    where: { studentId, isActive: true },
    include: { team: { include: TEAM_INCLUDE } },
  });
  return membership?.team ?? null;
}

// Aggregate every server-side rule (§46, §118). Return a stable, UI-friendly shape.
export type ValidationReport = {
  ok: boolean;
  checks: Array<{ key: string; label: string; pass: boolean; message?: string }>;
  errors: string[];
};

export async function validateForFinalize(teamId: string): Promise<ValidationReport> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: TEAM_INCLUDE,
  });
  if (!team) {
    return {
      ok: false,
      checks: [],
      errors: ["Team not found."],
    };
  }

  const checks: ValidationReport["checks"] = [];
  const errors: string[] = [];

  const activeMembers = team.members.filter((m) => m.isActive);
  const teamSize = config.team.size;

  // Exactly N members
  const sizeOk = activeMembers.length === teamSize;
  checks.push({
    key: "team_size",
    label: `Exactly ${teamSize} members`,
    pass: sizeOk,
    message: sizeOk ? `${activeMembers.length} of ${teamSize}` : `Have ${activeMembers.length}, need ${teamSize}`,
  });
  if (!sizeOk) errors.push(`Team must have exactly ${teamSize} members.`);

  // Exactly one leader
  const leaderCount = activeMembers.filter((m) => m.role === "LEADER").length;
  const leaderOk = leaderCount === 1;
  checks.push({
    key: "leader",
    label: "Exactly one leader",
    pass: leaderOk,
    message: `${leaderCount} leader(s)`,
  });
  if (!leaderOk) errors.push("Team must have exactly one leader.");

  // Female-member requirement
  const female = activeMembers.filter((m) => m.student.gender === "FEMALE").length;
  const femaleOk = female >= config.team.minFemaleMembers;
  checks.push({
    key: "female_requirement",
    label: `At least ${config.team.minFemaleMembers} female member`,
    pass: femaleOk,
    message: `${female} female member(s)`,
  });
  if (!femaleOk) errors.push(`Team must include at least ${config.team.minFemaleMembers} female member.`);

  // Every member's college_email is on the approved domain — cheap sanity check
  const college = await getCollege();
  const emailOk = activeMembers.every((m) => m.student.normalizedEmail.endsWith(`@${college.emailDomain}`));
  checks.push({
    key: "college_email",
    label: `All members use @${college.emailDomain}`,
    pass: emailOk,
  });
  if (!emailOk) errors.push(`All members must have an @${college.emailDomain} email.`);

  // PS selected & active
  const ps = team.psAssignments[0];
  const psOk = !!ps && ps.ps.status === "ACTIVE";
  checks.push({
    key: "ps",
    label: "Problem statement selected and active",
    pass: psOk,
    message: ps ? `${ps.ps.psNumber} — ${ps.ps.title}` : undefined,
  });
  if (!psOk) errors.push("A valid, active problem statement must be selected.");

  // Guidelines accepted
  const guidelinesOk = !!team.guidelinesAcceptedAt;
  checks.push({
    key: "guidelines",
    label: "Guidelines acknowledged",
    pass: guidelinesOk,
  });
  if (!guidelinesOk) errors.push("Leader must acknowledge the SIH guidelines.");

  // Deadline window
  const windowResult = isWithinRegistrationWindow();
  const windowOk = windowResult.ok;
  checks.push({
    key: "window",
    label: "Registration window is open",
    pass: windowOk,
    message: windowOk ? undefined : (windowResult as { ok: false; reason: string }).reason,
  });
  if (!windowOk) errors.push((windowResult as { ok: false; reason: string }).reason);

  // Registration mode
  const mode = await getRegistrationMode(team.collegeId);
  const modeOk = mode === "OPEN";
  checks.push({
    key: "mode",
    label: "Registration is not paused",
    pass: modeOk,
    message: modeOk ? "OPEN" : mode,
  });
  if (!modeOk) errors.push(`Registration is currently ${mode}.`);

  return { ok: errors.length === 0, checks, errors };
}
