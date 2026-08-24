import { prisma } from "@/lib/db";
import { getCollege } from "@/lib/college";
import { requireStudent, requireAdmin } from "@/lib/auth-guard";
import { fail, ok } from "@/lib/http";

export async function GET() {
  const student = await requireStudent();
  const admin = await requireAdmin();
  if (!student && !admin) return fail("UNAUTHORIZED", "Not signed in.", { status: 401 });

  const college = await getCollege();
  const cohorts = await prisma.cohort.findMany({
    where: { collegeId: college.id, isActive: true },
    orderBy: { batchYear: "desc" },
    select: { id: true, batchYear: true, displayName: true, yearOfStudy: true },
  });
  return ok({ cohorts });
}
