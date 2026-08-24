import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { requireStudent } from "@/lib/auth-guard";
import { prisma } from "@/lib/db";
import { getCollege, getRegistrationMode, isWithinRegistrationWindow } from "@/lib/college";
import { TeamWizard } from "./TeamWizard";
import { getStudentActiveTeam, getTeamByLeader, serialize, validateForFinalize } from "@/lib/team-service";
import { LogoutButton } from "./LogoutButton";
import type { CohortView } from "@/lib/team-types";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const student = await requireStudent();
  if (!student) redirect("/login");

  const college = await getCollege();
  const led = await getTeamByLeader(student.id);
  const membership = await getStudentActiveTeam(student.id);
  const activeTeam = led ?? membership;
  const validation = activeTeam ? await validateForFinalize(activeTeam.id) : null;
  const isLeader = led ? true : false;

  const cohortRows = await prisma.cohort.findMany({
    where: { collegeId: college.id, isActive: true },
    orderBy: { batchYear: "desc" },
    select: { id: true, batchYear: true, displayName: true, yearOfStudy: true },
  });
  const cohorts: CohortView[] = cohortRows;

  const windowResult = isWithinRegistrationWindow();
  const mode = await getRegistrationMode(college.id);

  return (
    <AppShell
      kind="student"
      actions={
        <div className="flex items-center gap-3">
          <div className="hidden sm:block text-right">
            <div className="text-sm font-medium">{student.fullName}</div>
            <div className="text-xs text-slate-500">{student.collegeEmail}</div>
          </div>
          <LogoutButton />
        </div>
      }
    >
      <div className="mx-auto max-w-5xl px-4 py-8">
        {!windowResult.ok && (
          <div className="mb-6 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            {windowResult.reason}
          </div>
        )}
        {mode !== "OPEN" && (
          <div className="mb-6 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            Registration is currently <b>{mode}</b>. New teams and edits are disabled by SPOC.
          </div>
        )}

        <TeamWizard
          me={{
            student: {
              id: student.id,
              fullName: student.fullName,
              email: student.collegeEmail,
              rollNumber: student.rollNumber,
              branch: student.branch,
              cohort: {
                id: student.cohort.id,
                displayName: student.cohort.displayName,
                batchYear: student.cohort.batchYear,
                yearOfStudy: student.cohort.yearOfStudy,
              },
            },
            activeTeamId: activeTeam?.id ?? null,
            ledTeamId: led?.id ?? null,
            role: led ? "LEADER" : membership ? "MEMBER" : null,
          }}
          initialTeam={activeTeam ? JSON.parse(JSON.stringify(serialize(activeTeam))) : null}
          initialValidation={validation}
          cohorts={cohorts}
          isLeader={isLeader}
        />

        <div className="mt-8 text-center text-xs text-slate-500">
          <Link href="/guidelines" className="underline">Guidelines</Link> · Team {college.name}
        </div>
      </div>
    </AppShell>
  );
}
