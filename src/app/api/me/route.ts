import { requireStudent } from "@/lib/auth-guard";
import { fail, ok } from "@/lib/http";
import { getStudentActiveTeam, getTeamByLeader } from "@/lib/team-service";

export async function GET() {
  const student = await requireStudent();
  if (!student) return fail("UNAUTHORIZED", "Not signed in.", { status: 401 });

  const membership = await getStudentActiveTeam(student.id);
  const ledTeam = await getTeamByLeader(student.id);

  return ok({
    student: {
      id: student.id,
      fullName: student.fullName,
      email: student.collegeEmail,
      rollNumber: student.rollNumber,
      branch: student.branch,
      cohort: {
        id: student.cohort.id,
        name: student.cohort.displayName,
        batchYear: student.cohort.batchYear,
        yearOfStudy: student.cohort.yearOfStudy,
      },
    },
    activeTeamId: membership?.id ?? null,
    ledTeamId: ledTeam?.id ?? null,
    role: ledTeam ? "LEADER" : membership ? "MEMBER" : null,
  });
}
