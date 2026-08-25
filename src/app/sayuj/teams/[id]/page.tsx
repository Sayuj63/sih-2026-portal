import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge, Card, CardBody, CardHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/db";
import { getCollege } from "@/lib/college";
import { validateForFinalize } from "@/lib/team-service";
import { AdminTeamActions } from "./AdminTeamActions";

export const dynamic = "force-dynamic";

export default async function AdminTeamDetail({ params }: PageProps<"/sayuj/teams/[id]">) {
  const admin = await requireAdmin();
  if (!admin) redirect("/sayuj/login");
  const { id } = await params;

  const college = await getCollege();
  const team = await prisma.team.findFirst({
    where: { id, collegeId: college.id },
    include: {
      leader: { include: { cohort: true } },
      members: { include: { student: { include: { cohort: true } } } },
      psAssignments: { include: { ps: true } },
      snapshot: true,
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

  const validation = await validateForFinalize(team.id);
  const audit = await prisma.auditLog.findMany({
    where: { resource: "Team", resourceId: team.id },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { admin: true },
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link href="/sayuj/teams" className="text-xs text-indigo-600">← All teams</Link>
          <h1 className="mt-1 text-2xl font-bold">{team.teamName}</h1>
          <div className="font-mono text-sm text-slate-500">{team.teamCode}</div>
        </div>
        <div className="flex gap-2 items-center">
          <Badge tone={team.status === "APPROVED" ? "success" : "info"}>{team.status}</Badge>
          {team.lockedAt && <Badge tone="warning">Locked</Badge>}
          <span className="text-xs text-slate-500">v{team.version}</span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader><h2 className="font-semibold">Members</h2></CardHeader>
            <CardBody>
              <ol className="space-y-2">
                {team.members.map((m, i) => (
                  <li key={m.id} className="flex items-center justify-between rounded border border-slate-200 p-3 text-sm">
                    <div>
                      <span className="mr-2 font-mono text-xs text-slate-400">#{i + 1}</span>
                      <span className="font-semibold">{m.student.fullName}</span>
                      <span className="ml-2 text-slate-500">
                        {m.student.rollNumber} · {m.student.cohort.displayName} · {m.student.branch}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      {m.role === "LEADER" && <Badge tone="info">Leader</Badge>}
                      <Badge>{m.student.gender}</Badge>
                    </div>
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>

          {team.psAssignments[0] && (
            <Card>
              <CardHeader><h2 className="font-semibold">Problem statement</h2></CardHeader>
              <CardBody>
                <div className="font-mono text-sm text-slate-500">{team.psAssignments[0].ps.psNumber}</div>
                <div className="text-lg font-semibold">{team.psAssignments[0].ps.title}</div>
                <div className="text-sm text-slate-600">{team.psAssignments[0].ps.organization}</div>
                <div className="text-xs text-slate-500 mt-1">{team.psAssignments[0].ps.theme} · {team.psAssignments[0].ps.category}</div>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader><h2 className="font-semibold">Audit history</h2></CardHeader>
            <CardBody>
              <ul className="space-y-2 text-sm">
                {audit.length === 0 && <li className="text-slate-500">No audit events yet.</li>}
                {audit.map((a) => (
                  <li key={a.id} className="border-b border-slate-100 pb-2 last:border-b-0">
                    <div className="flex flex-wrap gap-2 items-center">
                      <Badge tone="info">{a.action}</Badge>
                      <span className="text-xs text-slate-500">{a.createdAt.toLocaleString()}</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {a.actorType}{a.admin ? ` · ${a.admin.username}` : ""}
                    </div>
                    {a.reason && <div className="text-xs mt-1">Reason: {a.reason}</div>}
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><h2 className="font-semibold">Validation</h2></CardHeader>
            <CardBody>
              <ul className="space-y-2 text-sm">
                {validation.checks.map((c) => (
                  <li key={c.key} className="flex items-start gap-2">
                    <span className={c.pass ? "text-emerald-600" : "text-amber-600"}>{c.pass ? "✓" : "!"}</span>
                    <div>
                      <div className="font-medium">{c.label}</div>
                      {c.message && <div className="text-xs text-slate-500">{c.message}</div>}
                    </div>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>

          <AdminTeamActions
            teamId={team.id}
            status={team.status}
            locked={!!team.lockedAt}
          />
        </div>
      </div>

      {team.snapshot && (
        <Card>
          <CardHeader><h2 className="font-semibold">Frozen snapshot</h2></CardHeader>
          <CardBody>
            <p className="text-xs text-slate-500 mb-2">
              Point-in-time roster taken when the team was registered. Preserved even if the master directory changes later (spec §76–§77).
            </p>
            <pre className="max-h-64 overflow-auto rounded bg-slate-900 p-3 text-xs text-slate-100">{JSON.stringify(JSON.parse(team.snapshot.payload), null, 2)}</pre>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
