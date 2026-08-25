import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardBody, CardHeader, Badge } from "@/components/ui";
import { requireAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/db";
import { getCollege, getRegistrationMode, isWithinRegistrationWindow } from "@/lib/college";
import { config } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function AdminOverview() {
  const admin = await requireAdmin();
  if (!admin) redirect("/sayuj/login");

  const college = await getCollege();
  const [
    studentTotal,
    teamsTotal,
    teamsDraft,
    teamsRegistered,
    teamsRejected,
    psTotal,
    membershipTotal,
    teamsMissingFemale,
  ] = await Promise.all([
    prisma.student.count({ where: { collegeId: college.id, isActive: true } }),
    prisma.team.count({ where: { collegeId: college.id } }),
    prisma.team.count({ where: { collegeId: college.id, status: { in: ["DRAFT", "READY", "CORRECTION_REQUIRED"] } } }),
    prisma.team.count({ where: { collegeId: college.id, status: { in: ["APPROVED", "SUBMITTED", "LOCKED"] } } }),
    prisma.team.count({ where: { collegeId: college.id, status: "REJECTED" } }),
    prisma.problemStatement.count({ where: { collegeId: college.id, status: "ACTIVE" } }),
    prisma.teamMember.count({ where: { isActive: true } }),
    prisma.team.findMany({
      where: { collegeId: college.id },
      select: { id: true, members: { where: { isActive: true }, include: { student: true } } },
    }),
  ]);

  const missingFemale = teamsMissingFemale.filter(
    (t) => t.members.filter((m) => m.student.gender === "FEMALE").length < config.team.minFemaleMembers,
  ).length;

  const mode = await getRegistrationMode(college.id);
  const window = isWithinRegistrationWindow();

  const psAnalytics = await prisma.teamProblemStatement.groupBy({
    by: ["psId"],
    _count: { psId: true },
  });
  const topPs = psAnalytics.sort((a, b) => b._count.psId - a._count.psId).slice(0, 5);
  const topPsRecords = await prisma.problemStatement.findMany({
    where: { id: { in: topPs.map((p) => p.psId) } },
    select: { id: true, psNumber: true, title: true },
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Command Center</h1>
        <div className="flex gap-2">
          <Badge tone={mode === "OPEN" ? "success" : "warning"}>Mode: {mode}</Badge>
          <Badge tone={window.ok ? "success" : "danger"}>{window.ok ? "Window open" : "Window closed"}</Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
        <Kpi label="Students on roster"       value={studentTotal} />
        <Kpi label="Teams (all statuses)"     value={teamsTotal} />
        <Kpi label="Teams in progress"        value={teamsDraft} />
        <Kpi label="Teams registered"         value={teamsRegistered} tone="success" />
        <Kpi label="Teams rejected"           value={teamsRejected} tone="danger" />
        <Kpi label="Active memberships"       value={membershipTotal} />
        <Kpi label="Missing female member"    value={missingFemale} tone={missingFemale > 0 ? "warning" : "success"} />
        <Kpi label="Active PS in catalogue"   value={psTotal} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h2 className="font-semibold">Top selected PSs</h2>
            <Link href="/sayuj/ps" className="text-xs text-indigo-600 underline">Full PS analytics →</Link>
          </CardHeader>
          <CardBody>
            {topPs.length === 0 ? (
              <p className="text-sm text-slate-500">No PS selections yet.</p>
            ) : (
              <ol className="space-y-2 text-sm">
                {topPs.map((p) => {
                  const rec = topPsRecords.find((r) => r.id === p.psId);
                  return (
                    <li key={p.psId} className="flex items-center justify-between border-b border-slate-100 pb-2 last:border-b-0">
                      <div>
                        <div className="font-mono text-xs text-slate-500">{rec?.psNumber ?? p.psId}</div>
                        <div className="line-clamp-1">{rec?.title ?? "—"}</div>
                      </div>
                      <Badge tone="info">{p._count.psId} team{p._count.psId === 1 ? "" : "s"}</Badge>
                    </li>
                  );
                })}
              </ol>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader><h2 className="font-semibold">Quick actions</h2></CardHeader>
          <CardBody className="space-y-3 text-sm">
            <Link href="/sayuj/teams" className="block rounded border border-slate-200 p-3 hover:bg-slate-50">
              <div className="font-semibold">Review teams</div>
              <div className="text-slate-500 text-xs">Approve/reject, unlock, audit history.</div>
            </Link>
            <Link href="/sayuj/settings" className="block rounded border border-slate-200 p-3 hover:bg-slate-50">
              <div className="font-semibold">Registration window</div>
              <div className="text-slate-500 text-xs">OPEN · PAUSED · CLOSED</div>
            </Link>
            <Link href="/sayuj/audit" className="block rounded border border-slate-200 p-3 hover:bg-slate-50">
              <div className="font-semibold">Audit log</div>
              <div className="text-slate-500 text-xs">Every sensitive action, timestamped.</div>
            </Link>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: number; tone?: "success" | "warning" | "danger" }) {
  const color =
    tone === "success" ? "text-emerald-700" :
    tone === "warning" ? "text-amber-700" :
    tone === "danger"  ? "text-red-700"    :
    "text-slate-900";
  return (
    <Card>
      <CardBody>
        <div className="text-xs uppercase tracking-wider text-slate-500">{label}</div>
        <div className={`mt-1 text-3xl font-bold tracking-tight ${color}`}>{value}</div>
      </CardBody>
    </Card>
  );
}
