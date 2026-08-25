import { prisma } from "@/lib/db";
import { getCollege } from "@/lib/college";
import { ok } from "@/lib/http";

// Public — no auth required. Returns the active cohorts so the /register form can render them.
export async function GET() {
  const college = await getCollege();
  const rows = await prisma.cohort.findMany({
    where: { collegeId: college.id, isActive: true },
    orderBy: [{ batchYear: "asc" }, { displayName: "asc" }],
    select: { id: true, slug: true, batchYear: true, displayName: true, program: true, yearOfStudy: true },
  });
  return ok({ cohorts: rows });
}
