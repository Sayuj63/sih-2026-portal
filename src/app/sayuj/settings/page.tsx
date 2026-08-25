import { redirect } from "next/navigation";
import { Badge, Card, CardBody, CardHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth-guard";
import { getCollege, getRegistrationMode, isWithinRegistrationWindow } from "@/lib/college";
import { config } from "@/lib/config";
import { ModeSwitcher } from "./ModeSwitcher";

export const dynamic = "force-dynamic";

export default async function AdminSettings() {
  const admin = await requireAdmin();
  if (!admin) redirect("/sayuj/login");

  const college = await getCollege();
  const mode = await getRegistrationMode(college.id);
  const window = isWithinRegistrationWindow();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <h2 className="font-semibold">Registration mode</h2>
          <Badge tone={mode === "OPEN" ? "success" : mode === "PAUSED" ? "warning" : "danger"}>{mode}</Badge>
        </CardHeader>
        <CardBody>
          <p className="text-sm text-slate-600">
            <b>OPEN</b> allows new team creation and submissions.
            <b> PAUSED</b> lets students view but blocks new mutations.
            <b> CLOSED</b> blocks final registration entirely; only admin review/export continues.
          </p>
          <div className="mt-4">
            <ModeSwitcher current={mode} />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><h2 className="font-semibold">Registration window</h2></CardHeader>
        <CardBody className="text-sm space-y-2">
          <div>Opens: <b>{config.window.openAt.toLocaleString("en-IN", { timeZone: config.college.timezone })}</b></div>
          <div>Closes: <b>{config.window.closeAt.toLocaleString("en-IN", { timeZone: config.college.timezone })}</b></div>
          <div>Current status: <Badge tone={window.ok ? "success" : "danger"}>{window.ok ? "Open" : "Closed"}</Badge></div>
          {!window.ok && <div className="text-xs text-slate-500">{(window as { ok: false; reason: string }).reason}</div>}
          <p className="text-xs text-slate-500 mt-2">These are set via environment variables (<code>REGISTRATION_OPEN_AT</code>, <code>REGISTRATION_CLOSE_AT</code>) and enforced on the server — the browser clock is not trusted.</p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><h2 className="font-semibold">Team formation policy</h2></CardHeader>
        <CardBody className="text-sm grid gap-2 sm:grid-cols-3">
          <div><div className="text-xs text-slate-500">Team size</div><div className="text-lg font-semibold">{config.team.size}</div></div>
          <div><div className="text-xs text-slate-500">Minimum female members</div><div className="text-lg font-semibold">{config.team.minFemaleMembers}</div></div>
          <div><div className="text-xs text-slate-500">Email domain</div><div className="text-lg font-semibold">@{config.college.emailDomain}</div></div>
        </CardBody>
      </Card>
    </div>
  );
}
