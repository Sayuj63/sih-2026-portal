import { redirect } from "next/navigation";
import { Badge, Card, CardBody } from "@/components/ui";
import { requireAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminAudit() {
  const admin = await requireAdmin();
  if (!admin) redirect("/sayuj/login");

  const events = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { admin: true },
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold">Audit log</h1>
      <Card>
        <CardBody className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Time</th>
                <th className="px-3 py-2">Actor</th>
                <th className="px-3 py-2">Action</th>
                <th className="px-3 py-2">Resource</th>
                <th className="px-3 py-2">Reason</th>
                <th className="px-3 py-2">IP</th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-500">No events yet.</td></tr>
              ) : events.map((e) => (
                <tr key={e.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">{e.createdAt.toLocaleString()}</td>
                  <td className="px-3 py-2 text-xs">
                    <Badge tone="neutral">{e.actorType}</Badge>
                    {e.admin && <span className="ml-1 text-slate-500">{e.admin.username}</span>}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{e.action}</td>
                  <td className="px-3 py-2 text-xs text-slate-500">{e.resource}{e.resourceId ? ` · ${e.resourceId.slice(0, 8)}…` : ""}</td>
                  <td className="px-3 py-2 text-xs text-slate-500">{e.reason ?? ""}</td>
                  <td className="px-3 py-2 text-xs text-slate-500">{e.ip ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </div>
  );
}
