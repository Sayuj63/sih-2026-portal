import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge, Card, CardBody } from "@/components/ui";
import { requireAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/db";
import { getCollege } from "@/lib/college";
import { config } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function AdminTeams({ searchParams }: PageProps<"/sayuj/teams">) {
  const admin = await requireAdmin();
  if (!admin) redirect("/sayuj/login");
  const college = await getCollege();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : undefined;
  const status = typeof sp.status === "string" ? sp.status : undefined;

  const teams = await prisma.team.findMany({
    where: {
      collegeId: college.id,
      ...(status ? { status } : {}),
      ...(q
        ? {
            OR: [
              { teamName: { contains: q } },
              { teamCode: { contains: q } },
              { leader: { fullName: { contains: q } } },
              { leader: { rollNumber: { contains: q } } },
            ],
          }
        : {}),
    },
    include: {
      leader: { include: { cohort: true } },
      members: { where: { isActive: true }, include: { student: true } },
      psAssignments: { include: { ps: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold">Teams</h1>
        <form className="flex gap-2 text-sm">
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search name / code / leader"
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5"
          />
          <select name="status" defaultValue={status ?? ""} className="rounded-md border border-slate-300 bg-white px-3 py-1.5">
            <option value="">Any status</option>
            {["DRAFT", "READY", "SUBMITTED", "APPROVED", "REJECTED", "LOCKED", "CORRECTION_REQUIRED", "WITHDRAWN"].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button className="rounded-md bg-slate-900 text-white px-3 py-1.5">Filter</button>
        </form>
      </div>

      <Card>
        <CardBody className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Code</th>
                <th className="px-3 py-2">Team</th>
                <th className="px-3 py-2">Leader</th>
                <th className="px-3 py-2">Size</th>
                <th className="px-3 py-2">F</th>
                <th className="px-3 py-2">PS</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {teams.length === 0 ? (
                <tr><td colSpan={8} className="px-3 py-6 text-center text-slate-500">No teams match this filter.</td></tr>
              ) : teams.map((t) => {
                const female = t.members.filter((m) => m.student.gender === "FEMALE").length;
                const ps = t.psAssignments[0];
                const size = t.members.length;
                const sizeOk = size === config.team.size;
                const femaleOk = female >= config.team.minFemaleMembers;
                return (
                  <tr key={t.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2 font-mono text-xs">{t.teamCode}</td>
                    <td className="px-3 py-2 font-medium">{t.teamName}</td>
                    <td className="px-3 py-2">{t.leader.fullName} <span className="text-slate-400">· {t.leader.rollNumber}</span></td>
                    <td className="px-3 py-2"><Badge tone={sizeOk ? "success" : "warning"}>{size}/{config.team.size}</Badge></td>
                    <td className="px-3 py-2"><Badge tone={femaleOk ? "success" : "warning"}>{female}</Badge></td>
                    <td className="px-3 py-2 font-mono text-xs">{ps?.ps.psNumber ?? "—"}</td>
                    <td className="px-3 py-2"><Badge tone={statusTone(t.status)}>{t.status}</Badge></td>
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex items-center gap-3">
                        <Link href={`/sayuj/teams/${t.id}`} className="text-indigo-600 underline">View</Link>
                        <Link href={`/sayuj/teams/${t.id}/edit`} className="text-slate-700 underline">Edit</Link>
                      </div>
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

function statusTone(status: string): "info" | "success" | "warning" | "danger" | "neutral" {
  if (status === "APPROVED" || status === "LOCKED" || status === "SUBMITTED") return "success";
  if (status === "REJECTED" || status === "WITHDRAWN") return "danger";
  if (status === "CORRECTION_REQUIRED") return "warning";
  return "info";
}
