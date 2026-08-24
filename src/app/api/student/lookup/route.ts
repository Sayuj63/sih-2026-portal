import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireStudent } from "@/lib/auth-guard";
import { StudentLookupSchema, ValidationError, normalizeRollNumber } from "@/lib/validation";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { fail, ok } from "@/lib/http";
import { getCollege } from "@/lib/college";

// POST /api/student/lookup — cohort + roll → minimal student card, or a privacy-preserving 404.
// Never returns email/phone/team info (spec §87, §88).
export async function POST(req: NextRequest) {
  const student = await requireStudent();
  if (!student) return fail("UNAUTHORIZED", "Sign in to look up team members.", { status: 401 });

  const parsed = StudentLookupSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION_ERROR", "Cohort and roll number are required.");

  let normalizedRoll: string;
  try {
    normalizedRoll = normalizeRollNumber(parsed.data.rollNumber);
  } catch (e) {
    if (e instanceof ValidationError) return fail("BAD_ROLL", e.message);
    return fail("BAD_ROLL", "Invalid roll number.");
  }

  const rl = await checkRateLimit({
    key: `lookup:${student.id}:${clientIp(req)}`,
    max: 60,
    windowSec: 5 * 60,
  });
  if (!rl.allowed) return fail("RATE_LIMITED", "Slow down and try again shortly.", { status: 429 });

  const college = await getCollege();

  // Validate cohort belongs to this college — never trust the id.
  const cohort = await prisma.cohort.findFirst({
    where: { id: parsed.data.cohortId, collegeId: college.id, isActive: true },
  });
  if (!cohort) return fail("NOT_FOUND", "Student not found. Please verify cohort and roll number.", { status: 404 });

  const found = await prisma.student.findUnique({
    where: {
      cohortId_normalizedRollNumber: { cohortId: cohort.id, normalizedRollNumber: normalizedRoll },
    },
    include: {
      teamMemberships: { where: { isActive: true }, select: { id: true } },
    },
  });

  if (!found || !found.isActive) {
    return fail("NOT_FOUND", "Student not found. Please verify cohort and roll number.", { status: 404 });
  }

  const alreadyOnATeam = found.teamMemberships.length > 0;

  return ok({
    student: {
      id: found.id,
      fullName: found.fullName,
      rollNumber: found.rollNumber,
      branch: found.branch,
      gender: found.gender, // needed to preview female-count in UI; comes from roster, not the student's browser
      cohort: { id: cohort.id, displayName: cohort.displayName, batchYear: cohort.batchYear },
      available: !alreadyOnATeam,
      availabilityReason: alreadyOnATeam ? "Currently unavailable for team registration." : undefined,
    },
  });
}
