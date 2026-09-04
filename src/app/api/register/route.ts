import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCollege, getRegistrationMode, isWithinRegistrationWindow } from "@/lib/college";
import { config } from "@/lib/config";
import { normalizeEmail, normalizeName, normalizePsNumber, normalizeRollNumber, requireCollegeEmail, validateTeamName, ValidationError } from "@/lib/validation";
import { audit } from "@/lib/audit";
import { generateTeamCode } from "@/lib/team-code";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { fail, ok } from "@/lib/http";

const MemberSchema = z.object({
  fullName: z.string().min(2).max(80),
  rollNumber: z.string().min(1).max(32),
  cohortSlug: z.string().min(1).max(64),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]),
  email: z.string().min(3).max(120),
  branch: z.string().min(1).max(40),
});

const RegisterSchema = z.object({
  teamName: z.string().min(3).max(60),
  psNumber: z.string().min(1).max(32),
  psTitle: z.string().max(200).optional(),
  guidelinesAccepted: z.boolean(),
  members: z.array(MemberSchema).length(6),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = RegisterSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return fail("VALIDATION_ERROR", first?.message ?? "Please fill in every field.");
  }
  if (!parsed.data.guidelinesAccepted) {
    return fail("GUIDELINES_REQUIRED", "You must acknowledge the SIH guidelines to register.");
  }

  const ip = clientIp(req);

  const college = await getCollege();
  const windowResult = await isWithinRegistrationWindow(college.id);
  if (!windowResult.ok) return fail("WINDOW_CLOSED", windowResult.reason);
  const mode = await getRegistrationMode(college.id);
  if (mode !== "OPEN") return fail("WINDOW_CLOSED", `Registration is currently ${mode}.`);

  const rl = await checkRateLimit({
    key: `register:${ip}`,
    max: 20,
    windowSec: 60 * 60,
  });
  if (!rl.allowed) {
    return fail("RATE_LIMITED", "Too many submissions from this network. Please try again later.", { status: 429 });
  }

  // Team name check
  let teamName: { normalized: string; display: string };
  try {
    teamName = validateTeamName(parsed.data.teamName);
  } catch (e) {
    if (e instanceof ValidationError) return fail("BAD_TEAM_NAME", e.message);
    return fail("BAD_TEAM_NAME", "Invalid team name.");
  }

  // Look up every cohort up-front so we can fail fast on a bad slug.
  const uniqueSlugs = Array.from(new Set(parsed.data.members.map((m) => m.cohortSlug)));
  const cohortRows = await prisma.cohort.findMany({
    where: { collegeId: college.id, slug: { in: uniqueSlugs }, isActive: true },
  });
  const cohortBySlug = new Map(cohortRows.map((c) => [c.slug, c]));
  for (const slug of uniqueSlugs) {
    if (!cohortBySlug.has(slug)) return fail("BAD_COHORT", `Unknown cohort "${slug}". Refresh the page and try again.`);
  }

  // Normalise every member
  type NormalizedMember = {
    fullName: string;
    normalizedRoll: string;
    cohortSlug: string;
    cohortId: string;
    gender: "MALE" | "FEMALE" | "OTHER";
    normalizedEmail: string;
    rawEmail: string;
    branch: string;
    rawRoll: string;
  };
  const norm: NormalizedMember[] = [];
  const seenRollsInThisTeam = new Set<string>();
  const seenEmailsInThisTeam = new Set<string>();

  for (let i = 0; i < parsed.data.members.length; i++) {
    const m = parsed.data.members[i];
    let rEmail: string;
    try {
      rEmail = requireCollegeEmail(m.email);
    } catch (e) {
      if (e instanceof ValidationError) return fail("BAD_EMAIL", `Member ${i + 1}: ${e.message}`);
      return fail("BAD_EMAIL", `Member ${i + 1}: invalid email.`);
    }
    let rRoll: string;
    try {
      rRoll = normalizeRollNumber(m.rollNumber);
    } catch (e) {
      if (e instanceof ValidationError) return fail("BAD_ROLL", `Member ${i + 1}: ${e.message}`);
      return fail("BAD_ROLL", `Member ${i + 1}: invalid roll number.`);
    }
    const cohort = cohortBySlug.get(m.cohortSlug)!;
    const rollKey = `${cohort.id}:${rRoll}`;
    if (seenRollsInThisTeam.has(rollKey)) {
      return fail("DUPLICATE_MEMBER", `Member ${i + 1}: roll ${m.rollNumber} is repeated in this team.`);
    }
    seenRollsInThisTeam.add(rollKey);
    if (seenEmailsInThisTeam.has(rEmail)) {
      return fail("DUPLICATE_MEMBER", `Member ${i + 1}: email ${m.email} is repeated in this team.`);
    }
    seenEmailsInThisTeam.add(rEmail);

    norm.push({
      fullName: m.fullName.trim().replace(/\s+/g, " "),
      normalizedRoll: rRoll,
      cohortSlug: m.cohortSlug,
      cohortId: cohort.id,
      gender: m.gender,
      normalizedEmail: rEmail,
      rawEmail: m.email.trim(),
      branch: m.branch.trim().toUpperCase(),
      rawRoll: m.rollNumber.trim(),
    });
  }

  const female = norm.filter((n) => n.gender === "FEMALE").length;
  if (female < config.team.minFemaleMembers) {
    return fail("FEMALE_REQUIREMENT", `Team must include at least ${config.team.minFemaleMembers} female member.`);
  }

  const psNumber = normalizePsNumber(parsed.data.psNumber);

  const teamCode = await generateTeamCode();

  // Do the whole thing in a transaction. If any student's active-team constraint or
  // the team-name unique constraint fails, the whole registration rolls back.
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Cohorts are pre-loaded above; just use their IDs.

      // Upsert Student rows keyed by (cohort, normalizedRoll). This preserves the
      // core anti-duplicate DB constraint from the spec.
      const studentIds: string[] = [];
      for (const m of norm) {
        const cohortId = m.cohortId;
        const s = await tx.student.upsert({
          where: {
            cohortId_normalizedRollNumber: { cohortId, normalizedRollNumber: m.normalizedRoll },
          },
          update: {
            fullName: m.fullName,
            normalizedName: normalizeName(m.fullName),
            rollNumber: m.rawRoll,
            collegeEmail: m.rawEmail,
            normalizedEmail: m.normalizedEmail,
            gender: m.gender,
            branch: m.branch,
          },
          create: {
            collegeId: college.id,
            cohortId,
            fullName: m.fullName,
            normalizedName: normalizeName(m.fullName),
            rollNumber: m.rawRoll,
            normalizedRollNumber: m.normalizedRoll,
            collegeEmail: m.rawEmail,
            normalizedEmail: m.normalizedEmail,
            gender: m.gender,
            branch: m.branch,
          },
        });
        studentIds.push(s.id);
      }

      // Upsert a Problem Statement record — free text allowed but stored in the trusted table.
      const ps = await tx.problemStatement.upsert({
        where: {
          collegeId_normalizedPsNumber: { collegeId: college.id, normalizedPsNumber: psNumber },
        },
        update: {
          ...(parsed.data.psTitle ? { title: parsed.data.psTitle } : {}),
        },
        create: {
          collegeId: college.id,
          psNumber: parsed.data.psNumber.trim(),
          normalizedPsNumber: psNumber,
          title: parsed.data.psTitle?.trim() || `Problem Statement ${parsed.data.psNumber}`,
          organization: "Submitted by team",
          theme: "Not specified",
          category: "Not specified",
          description: "Team-supplied problem statement — verify against the official SIH portal.",
        },
      });

      // Create the team; first member is the leader.
      const team = await tx.team.create({
        data: {
          collegeId: college.id,
          teamCode,
          teamName: teamName.display,
          normalizedTeamName: teamName.normalized,
          leaderStudentId: studentIds[0],
          status: "SUBMITTED",
          guidelinesAcceptedAt: new Date(),
          submittedAt: new Date(),
          lockedAt: new Date(),
        },
      });

      // Members
      for (let i = 0; i < studentIds.length; i++) {
        await tx.teamMember.create({
          data: {
            teamId: team.id,
            studentId: studentIds[i],
            role: i === 0 ? "LEADER" : "MEMBER",
            isActive: true,
          },
        });
      }

      // PS assignment
      await tx.teamProblemStatement.create({
        data: { teamId: team.id, psId: ps.id },
      });

      // Snapshot
      const snapshotPayload = JSON.stringify({
        teamCode,
        teamName: teamName.display,
        registeredAt: new Date().toISOString(),
        ps: {
          psNumber: parsed.data.psNumber.trim(),
          title: parsed.data.psTitle ?? null,
        },
        members: norm.map((m, i) => ({
          role: i === 0 ? "LEADER" : "MEMBER",
          fullName: m.fullName,
          rollNumber: m.rawRoll,
          cohort: m.cohortSlug,
          gender: m.gender,
          email: m.rawEmail,
          branch: m.branch,
        })),
      });
      await tx.teamSnapshot.create({
        data: { teamId: team.id, payload: snapshotPayload },
      });

      return team;
    });

    await audit({
      actorType: "STUDENT",
      actorId: null,
      action: "TEAM_REGISTERED_SIMPLE",
      resource: "Team",
      resourceId: result.id,
      after: { teamCode, teamName: teamName.display },
      ip,
      userAgent: req.headers.get("user-agent"),
    });

    return ok({
      teamCode,
      teamName: teamName.display,
      registeredAt: result.submittedAt,
    });
  } catch (e: unknown) {
    const err = e as { code?: string; meta?: { target?: unknown; modelName?: string }; message?: string };
    const targetText = JSON.stringify(err?.meta ?? {}) + " " + (err?.message ?? "");
    if (err?.code === "P2002" || err?.code === "P2010" || /UNIQUE constraint failed/i.test(targetText)) {
      if (/normalizedTeamName|Team_collegeId_normalizedTeamName/.test(targetText)) {
        return fail("TEAM_NAME_TAKEN", "That team name is already registered. Choose another.");
      }
      if (/isActive/.test(targetText) && /studentId/.test(targetText)) {
        return fail("ALREADY_ON_TEAM", "One or more members are already on another registered team.");
      }
      if (/normalizedEmail/.test(targetText)) {
        return fail("EMAIL_TAKEN", "One of the emails is already used by a different student on our roster.");
      }
      if (/normalizedRollNumber/.test(targetText)) {
        return fail("ROLL_TAKEN", "One of the roll numbers already belongs to a different student in that cohort.");
      }
      return fail("CONFLICT", "A uniqueness rule blocked this registration. Check team name, member emails, and roll numbers.");
    }
    console.error("register error", err?.code, err?.message, err?.meta);
    return fail("SERVER_ERROR", "Could not save your registration. Please try again.", { status: 500 });
  }
}

