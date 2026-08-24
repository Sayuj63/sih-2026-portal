import { redirect } from "next/navigation";
import { Badge, Card, CardBody } from "@/components/ui";
import { requireAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/db";
import { getCollege } from "@/lib/college";

export const dynamic = "force-dynamic";

export default async function AdminStudents({ searchParams }: PageProps<"/admin/students">) {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");

  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : undefined;
  const cohortId = typeof sp.cohort === "string" ? sp.cohort : undefined;

  const college = await getCollege();
  const cohorts = await prisma.cohort.findMany({
    where: { collegeId: college.id, isActive: true },
    orderBy: { batchYear: "desc" },
  });

  const rows = await prisma.student.findMany({
    where: {
      collegeId: college.id,
      ...(cohortId ? { cohortId } : {}),
      ...(q
        ? {
            OR: [
              { fullName: { contains: q } },
              { rollNumber: { contains: q } },
              { collegeEmail: { contains: q } },
            ],
          }
        : {}),
    },
    include: {
      cohort: true,
      teamMemberships: { where: { isActive: true }, include: { team: true } },
    },
    orderBy: [{ cohort: { batchYear: "desc" } }, { fullName: "asc" }],
    take: 500,
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold">Students</h1>
        <form className="flex gap-2 text-sm">
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search name / roll / email"
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5"
          />
          <select name="cohort" defaultValue={cohortId ?? ""} className="rounded-md border border-slate-300 bg-white px-3 py-1.5">
            <option value="">All cohorts</option>
            {cohorts.map((c) => <option key={c.id} value={c.id}>{c.displayName} · {c.batchYear}</option>)}
          </select>
          <button className="rounded-md bg-slate-900 text-white px-3 py-1.5">Filter</button>
        </form>
      </div>

      <Card>
        <CardBody className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Roll</th>
                <th className="px-3 py-2">Cohort</th>
                <th className="px-3 py-2">Branch</th>
                <th className="px-3 py-2">Gender</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Team</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const t = s.teamMemberships[0];
                return (
                  <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium">{s.fullName}</td>
                    <td className="px-3 py-2 font-mono text-xs">{s.rollNumber}</td>
                    <td className="px-3 py-2">{s.cohort.displayName} <span className="text-slate-400">· {s.cohort.batchYear}</span></td>
                    <td className="px-3 py-2">{s.branch}</td>
                    <td className="px-3 py-2">{s.gender === "FEMALE" ? <Badge tone="success">F</Badge> : <span className="text-xs text-slate-500">{s.gender}</span>}</td>
                    <td className="px-3 py-2 text-xs text-slate-500">{s.collegeEmail}</td>
                    <td className="px-3 py-2 text-xs">
                      {t ? (
                        <span>
                          <Badge tone="info">{t.team.teamCode}</Badge> {t.role}
                        </span>
                      ) : <span className="text-slate-400">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </div>
  );
}
