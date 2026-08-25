import { redirect } from "next/navigation";
import { Badge, Card, CardBody } from "@/components/ui";
import { requireAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/db";
import { getCollege } from "@/lib/college";

export const dynamic = "force-dynamic";

export default async function AdminPs() {
  const admin = await requireAdmin();
  if (!admin) redirect("/sayuj/login");

  const college = await getCollege();
  const psList = await prisma.problemStatement.findMany({
    where: { collegeId: college.id },
    include: { _count: { select: { teamAssignments: true } } },
    orderBy: { psNumber: "asc" },
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Problem statements</h1>
        <Badge tone="info">{psList.length} total</Badge>
      </div>

      <Card>
        <CardBody className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Number</th>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Organization</th>
                <th className="px-3 py-2">Theme</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2 text-right">Selected by</th>
              </tr>
            </thead>
            <tbody>
              {psList.map((p) => (
                <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono text-xs">{p.psNumber}</td>
                  <td className="px-3 py-2">{p.title}</td>
                  <td className="px-3 py-2 text-slate-600">{p.organization}</td>
                  <td className="px-3 py-2 text-xs text-slate-500">{p.theme}</td>
                  <td className="px-3 py-2 text-xs text-slate-500">{p.category}</td>
                  <td className="px-3 py-2 text-right">
                    <Badge tone={p._count.teamAssignments > 0 ? "info" : "neutral"}>{p._count.teamAssignments}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </div>
  );
}
