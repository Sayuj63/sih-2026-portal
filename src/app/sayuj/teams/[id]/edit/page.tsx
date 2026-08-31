import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/db";
import { getCollege } from "@/lib/college";
import { EditTeamForm } from "./EditTeamForm";

export const dynamic = "force-dynamic";

export default async function EditTeamPage({ params }: PageProps<"/sayuj/teams/[id]/edit">) {
  const admin = await requireAdmin();
  if (!admin) redirect("/sayuj/login");
  const { id } = await params;
  const college = await getCollege();

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

  if (!team) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <p>Team not found.</p>
        <Link href="/sayuj/teams" className="text-indigo-600 underline">← All teams</Link>
      </div>
    );
  }

  const cohorts = await prisma.cohort.findMany({
    where: { collegeId: college.id, isActive: true },
    orderBy: [{ batchYear: "desc" }, { displayName: "asc" }],
    select: { id: true, displayName: true, batchYear: true, program: true },
  });

  const activePs = team.psAssignments[0]?.ps ?? null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      <div>
        <Link href={`/sayuj/teams/${team.id}`} className="text-xs text-indigo-600">← Back to team</Link>
        <h1 className="mt-1 text-2xl font-bold">Edit team</h1>
        <p className="text-sm text-slate-500">
          Full admin edit — team fields, PS assignment, and every member&apos;s student record. Student
          edits propagate to the master directory (same student everywhere on the portal). Every save
          is written to the audit log.
        </p>
      </div>

      <EditTeamForm
        teamId={team.id}
        cohorts={cohorts}
        initial={{
          team: {
            teamName: team.teamName,
            teamCode: team.teamCode,
            status: team.status,
            psNumber: activePs?.psNumber ?? "",
          },
          members: team.members.map((m) => ({
            teamMemberId: m.id,
            studentId: m.student.id,
            role: m.role,
            fullName: m.student.fullName,
            rollNumber: m.student.rollNumber,
            cohortId: m.student.cohortId,
            gender: m.student.gender,
            branch: m.student.branch,
            section: m.student.section ?? "",
            mobileNumber: m.student.mobileNumber ?? "",
            collegeEmail: m.student.collegeEmail,
          })),
        }}
      />
    </div>
  );
}
