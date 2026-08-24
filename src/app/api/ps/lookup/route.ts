import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireStudent } from "@/lib/auth-guard";
import { PsLookupSchema, ValidationError, normalizePsNumber } from "@/lib/validation";
import { getCollege } from "@/lib/college";
import { fail, ok } from "@/lib/http";

export async function POST(req: NextRequest) {
  const student = await requireStudent();
  if (!student) return fail("UNAUTHORIZED", "Not signed in.", { status: 401 });

  const parsed = PsLookupSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION_ERROR", "PS number is required.");

  let normalized: string;
  try {
    normalized = normalizePsNumber(parsed.data.psNumber);
  } catch (e) {
    if (e instanceof ValidationError) return fail("BAD_PS", e.message);
    return fail("BAD_PS", "Invalid PS number.");
  }

  const college = await getCollege();
  const ps = await prisma.problemStatement.findUnique({
    where: { collegeId_normalizedPsNumber: { collegeId: college.id, normalizedPsNumber: normalized } },
  });

  if (!ps || ps.status !== "ACTIVE") {
    return fail("NOT_FOUND", "Problem Statement not found. Please check the PS number.", { status: 404 });
  }

  return ok({
    ps: {
      id: ps.id,
      psNumber: ps.psNumber,
      title: ps.title,
      organization: ps.organization,
      theme: ps.theme,
      category: ps.category,
      description: ps.description,
    },
    note: "This problem statement can be selected by multiple teams.",
  });
}
