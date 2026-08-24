"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";
import { Alert, Badge, Button, Card, CardBody, CardHeader, Field, Input, Select } from "@/components/ui";
import { api } from "@/lib/client-fetch";
import type { CohortView, MeResponse, TeamMemberView, TeamView, ValidationView } from "@/lib/team-types";

type Props = {
  me: MeResponse;
  initialTeam: TeamView | null;
  initialValidation: ValidationView | null;
  cohorts: CohortView[];
  isLeader: boolean;
};

export function TeamWizard(props: Props) {
  const [team, setTeam] = useState<TeamView | null>(props.initialTeam);
  const [validation, setValidation] = useState<ValidationView | null>(props.initialValidation);
  const isLeader = props.isLeader || team?.leader.id === props.me.student.id;

  if (team?.lockedAt) {
    return <RegistrationReceipt team={team} />;
  }

  if (!team) {
    return (
      <CreateTeamCard
        me={props.me}
        onCreated={(t, v) => {
          setTeam(t);
          setValidation(v);
        }}
      />
    );
  }

  if (!isLeader) {
    return <NonLeaderView team={team} />;
  }

  return (
    <LeaderBuilder
      me={props.me}
      team={team}
      validation={validation}
      cohorts={props.cohorts}
      onUpdate={(t, v) => {
        setTeam(t);
        if (v) setValidation(v);
      }}
    />
  );
}

// ------------------------------------------------------------------ Create card
function CreateTeamCard({ me, onCreated }: {
  me: MeResponse;
  onCreated: (team: TeamView, validation: ValidationView | null) => void;
}) {
  const [teamName, setTeamName] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const r = await api<{ team: TeamView }>("/api/team", {
      method: "POST",
      body: JSON.stringify({ teamName, guidelinesAccepted: accepted }),
    });
    setBusy(false);
    if (!r.ok) {
      setError(r.error.message);
      return;
    }
    // Fresh validation
    const v = await api<{ team: TeamView; validation: ValidationView }>("/api/team");
    onCreated(r.data.team, v.ok ? v.data.validation : null);
  }

  return (
    <div className="grid gap-6 md:grid-cols-[3fr_2fr]">
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Create your team</h2>
          <p className="mt-1 text-sm text-slate-500">You&apos;ll become the team leader.</p>
        </CardHeader>
        <CardBody>
          <form className="space-y-4" onSubmit={submit}>
            <Field
              label="Team name"
              hint="3–60 characters. Case-insensitive uniqueness — must not include the institute name."
            >
              <Input
                required
                autoFocus
                minLength={3}
                maxLength={60}
                placeholder="e.g. Nebula"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
              />
            </Field>

            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
              />
              <span>
                I have read the <Link href="/guidelines" className="underline text-indigo-700">SIH 2026 guidelines</Link>, understand the internal hackathon team rules, and confirm the registration information will be accurate.
              </span>
            </label>

            {error && <Alert tone="danger">{error}</Alert>}
            <Button type="submit" loading={busy} disabled={!accepted || teamName.length < 3}>Create team</Button>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><h3 className="font-semibold">Signed in as</h3></CardHeader>
        <CardBody className="text-sm space-y-1">
          <div className="font-medium">{me.student.fullName}</div>
          <div className="text-slate-500">{me.student.email}</div>
          <div className="text-slate-500">{me.student.rollNumber} · {me.student.branch}</div>
          <div className="text-slate-500">{me.student.cohort.displayName} · Batch {me.student.cohort.batchYear} · Year {me.student.cohort.yearOfStudy}</div>
        </CardBody>
      </Card>
    </div>
  );
}

// -------------------------------------------------------------- Leader builder
function LeaderBuilder({
  me,
  team,
  validation,
  cohorts,
  onUpdate,
}: {
  me: MeResponse;
  team: TeamView;
  validation: ValidationView | null;
  cohorts: CohortView[];
  onUpdate: (team: TeamView, validation: ValidationView | null) => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState(false);

  async function refresh() {
    const r = await api<{ team: TeamView; validation: ValidationView }>("/api/team");
    if (r.ok) onUpdate(r.data.team, r.data.validation);
  }

  async function finalize() {
    if (!validation?.ok) return;
    setError(null);
    setFinalizing(true);
    const idem = crypto.randomUUID();
    const r = await api<{ team: TeamView; registration: { teamCode: string; registeredAt: string }; alreadyRegistered: boolean }>(
      "/api/team/finalize",
      { method: "POST", body: JSON.stringify({ idempotencyKey: idem }) },
    );
    setFinalizing(false);
    if (!r.ok) {
      setError(r.error.message);
      await refresh();
      return;
    }
    router.refresh();
    onUpdate(r.data.team, null);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wider text-slate-500">Team</div>
          <h2 className="text-2xl font-bold">{team.teamName} <span className="ml-2 font-mono text-sm text-slate-500">{team.teamCode}</span></h2>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={team.status === "APPROVED" ? "success" : "info"}>{team.status}</Badge>
          <span className="text-xs text-slate-500">v{team.version}</span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <div className="space-y-6">
          <MembersCard team={team} me={me} cohorts={cohorts} onChange={refresh} onError={setError} />
          <PsCard team={team} onChange={refresh} onError={setError} />
        </div>

        <div className="space-y-6">
          <ValidationPanel validation={validation} />
          {error && <Alert tone="danger">{error}</Alert>}
          <Card>
            <CardBody className="space-y-3">
              <h3 className="font-semibold">Final registration</h3>
              <p className="text-sm text-slate-600">
                Once you register, the team is locked. Only the SPOC can unlock it for corrections.
              </p>
              <Button
                onClick={finalize}
                loading={finalizing}
                disabled={!validation?.ok}
                className="w-full"
              >
                Register team
              </Button>
              {!validation?.ok && (
                <p className="text-xs text-slate-500">Resolve the issues in the checklist first.</p>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------- Members
function MembersCard({
  team,
  me,
  cohorts,
  onChange,
  onError,
}: {
  team: TeamView;
  me: MeResponse;
  cohorts: CohortView[];
  onChange: () => Promise<void>;
  onError: (msg: string) => void;
}) {
  const slots = 6;
  const emptySlots = Math.max(0, slots - team.members.length);
  const leader = team.members.find((m) => m.role === "LEADER");
  const others = team.members.filter((m) => m.role !== "LEADER");

  const [cohortId, setCohortId] = useState<string>(cohorts[0]?.id ?? "");
  const [roll, setRoll] = useState("");
  const [preview, setPreview] = useState<null | {
    id: string;
    fullName: string;
    rollNumber: string;
    branch: string;
    gender: string;
    cohort: { id: string; displayName: string; batchYear: number };
    available: boolean;
    availabilityReason?: string;
  }>(null);
  const [busy, setBusy] = useState(false);

  async function doLookup(e: React.FormEvent) {
    e.preventDefault();
    onError("");
    setBusy(true);
    setPreview(null);
    const r = await api<{ student: NonNullable<typeof preview> }>("/api/student/lookup", {
      method: "POST",
      body: JSON.stringify({ cohortId, rollNumber: roll }),
    });
    setBusy(false);
    if (!r.ok) {
      onError(r.error.message);
      return;
    }
    if (team.members.some((m) => m.student.id === r.data.student.id)) {
      onError("This student is already on your team.");
      return;
    }
    setPreview(r.data.student);
  }

  async function addMember() {
    if (!preview) return;
    setBusy(true);
    const r = await api<{ team: TeamView }>("/api/team/member", {
      method: "POST",
      body: JSON.stringify({ cohortId: preview.cohort.id, rollNumber: preview.rollNumber }),
    });
    setBusy(false);
    if (!r.ok) {
      onError(r.error.message);
      return;
    }
    setPreview(null);
    setRoll("");
    await onChange();
  }

  async function removeMember(memberId: string) {
    setBusy(true);
    const r = await api<{ team: TeamView }>(`/api/team/member?memberId=${encodeURIComponent(memberId)}`, {
      method: "DELETE",
    });
    setBusy(false);
    if (!r.ok) {
      onError(r.error.message);
      return;
    }
    await onChange();
  }

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Members</h3>
          <p className="text-xs text-slate-500">{team.members.length} of {slots} filled</p>
        </div>
        <Badge tone={team.members.length === slots ? "success" : "warning"}>
          {team.members.length}/{slots}
        </Badge>
      </CardHeader>
      <CardBody>
        <ol className="space-y-3">
          {leader && <MemberRow index={1} member={leader} isYou={leader.student.id === me.student.id} onRemove={undefined} />}
          {others.map((m, i) => (
            <MemberRow
              key={m.id}
              index={i + 2}
              member={m}
              isYou={m.student.id === me.student.id}
              onRemove={() => removeMember(m.id)}
              busy={busy}
            />
          ))}
          {Array.from({ length: emptySlots }).map((_, i) => (
            <EmptySlot key={`empty-${i}`} index={team.members.length + i + 1} />
          ))}
        </ol>

        {team.members.length < slots && (
          <div className="mt-6 rounded-lg border border-dashed border-slate-300 p-4">
            <h4 className="text-sm font-semibold">Add a member</h4>
            <p className="text-xs text-slate-500">Enter cohort + roll number. The server resolves the student from the college directory.</p>
            <form onSubmit={doLookup} className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] items-end">
              <Field label="Cohort">
                <Select value={cohortId} onChange={(e) => { setCohortId(e.target.value); setPreview(null); }}>
                  {cohorts.map((c) => (
                    <option key={c.id} value={c.id}>{c.displayName} · Batch {c.batchYear}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Roll number">
                <Input value={roll} onChange={(e) => setRoll(e.target.value)} placeholder="e.g. CSE107" required />
              </Field>
              <Button type="submit" loading={busy} disabled={!cohortId || roll.length === 0}>Look up</Button>
            </form>
            {preview && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                <div className="text-sm">
                  <div className="font-semibold">{preview.fullName}</div>
                  <div className="text-slate-500">
                    {preview.rollNumber} · {preview.cohort.displayName} · {preview.branch}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {preview.available ? (
                    <Badge tone="success">Available</Badge>
                  ) : (
                    <Badge tone="warning">{preview.availabilityReason ?? "Unavailable"}</Badge>
                  )}
                  <Button onClick={addMember} disabled={!preview.available} loading={busy}>Add</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function MemberRow({
  index,
  member,
  isYou,
  onRemove,
  busy,
}: {
  index: number;
  member: TeamMemberView;
  isYou: boolean;
  onRemove?: () => void;
  busy?: boolean;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 p-3">
      <div className="flex items-center gap-3">
        <span className={clsx("inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold",
          member.role === "LEADER" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700")}>{index}</span>
        <div>
          <div className="text-sm font-semibold">
            {member.student.fullName} {isYou && <span className="ml-1 text-xs text-slate-500">(you)</span>}
          </div>
          <div className="text-xs text-slate-500">
            {member.student.rollNumber} · {member.student.cohort.displayName} · {member.student.branch}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {member.role === "LEADER" ? <Badge tone="info">Leader</Badge> : <Badge>Member</Badge>}
        {member.student.gender === "FEMALE" && <Badge tone="success">F</Badge>}
        {onRemove && (
          <Button variant="ghost" onClick={onRemove} disabled={busy} className="text-red-600 hover:bg-red-50">Remove</Button>
        )}
      </div>
    </li>
  );
}

function EmptySlot({ index }: { index: number }) {
  return (
    <li className="flex items-center gap-3 rounded-md border border-dashed border-slate-300 p-3 text-sm text-slate-500">
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-400 font-bold">{index}</span>
      Slot open
    </li>
  );
}

// -------------------------------------------------------------------- PS Card
function PsCard({
  team,
  onChange,
  onError,
}: {
  team: TeamView;
  onChange: () => Promise<void>;
  onError: (msg: string) => void;
}) {
  const [psNumber, setPsNumber] = useState("");
  const [preview, setPreview] = useState<null | { id: string; psNumber: string; title: string; organization: string; theme: string; category: string; description: string }>(null);
  const [busy, setBusy] = useState(false);

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    onError("");
    setBusy(true);
    setPreview(null);
    const r = await api<{ ps: NonNullable<typeof preview>; note: string }>("/api/ps/lookup", {
      method: "POST",
      body: JSON.stringify({ psNumber }),
    });
    setBusy(false);
    if (!r.ok) {
      onError(r.error.message);
      return;
    }
    setPreview(r.data.ps);
  }

  async function pick() {
    if (!preview) return;
    setBusy(true);
    const r = await api<{ team: TeamView }>("/api/team/ps", {
      method: "POST",
      body: JSON.stringify({ psId: preview.id }),
    });
    setBusy(false);
    if (!r.ok) {
      onError(r.error.message);
      return;
    }
    setPreview(null);
    setPsNumber("");
    await onChange();
  }

  return (
    <Card>
      <CardHeader>
        <h3 className="font-semibold">Problem statement</h3>
        <p className="text-xs text-slate-500">Look up any SIH 2026 PS number. Multiple teams may pick the same PS.</p>
      </CardHeader>
      <CardBody>
        {team.ps ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-center gap-2">
              <Badge tone="success">✓ Selected</Badge>
              <span className="font-mono text-sm">{team.ps.psNumber}</span>
            </div>
            <h4 className="mt-2 font-semibold">{team.ps.title}</h4>
            <div className="text-sm text-slate-600">{team.ps.organization}</div>
            <div className="mt-1 text-xs text-slate-500">{team.ps.theme} · {team.ps.category}</div>
          </div>
        ) : null}

        <form onSubmit={lookup} className="mt-4 flex gap-2">
          <Input
            placeholder="e.g. SIH-2026-1401"
            value={psNumber}
            onChange={(e) => setPsNumber(e.target.value.toUpperCase())}
          />
          <Button type="submit" loading={busy}>Look up</Button>
        </form>

        {preview && (
          <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2">
              <Badge tone="info">Valid</Badge>
              <span className="font-mono text-sm">{preview.psNumber}</span>
            </div>
            <h4 className="mt-2 font-semibold">{preview.title}</h4>
            <div className="text-sm text-slate-600">{preview.organization}</div>
            <div className="mt-1 text-xs text-slate-500">{preview.theme} · {preview.category}</div>
            <p className="mt-2 text-xs text-slate-500">This problem statement can be selected by multiple teams.</p>
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setPreview(null)}>Cancel</Button>
              <Button onClick={pick} loading={busy}>{team.ps ? "Replace selection" : "Select this PS"}</Button>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

// ------------------------------------------------------------- Validation panel
function ValidationPanel({ validation }: { validation: ValidationView | null }) {
  const checks = validation?.checks ?? [];
  const passed = useMemo(() => checks.filter((c) => c.pass).length, [checks]);
  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <h3 className="font-semibold">Validation</h3>
        <Badge tone={validation?.ok ? "success" : "warning"}>
          {validation?.ok ? "Ready" : `${passed}/${checks.length}`}
        </Badge>
      </CardHeader>
      <CardBody>
        <ul className="space-y-2 text-sm">
          {checks.map((c) => (
            <li key={c.key} className="flex items-start gap-2">
              <span className={clsx("mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold",
                c.pass ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
                {c.pass ? "✓" : "!"}
              </span>
              <div>
                <div className="font-medium">{c.label}</div>
                {c.message && <div className="text-xs text-slate-500">{c.message}</div>}
              </div>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}

// ---------------------------------------------------------- Non-leader (member)
function NonLeaderView({ team }: { team: TeamView }) {
  return (
    <div className="space-y-4">
      <Alert tone="info" title="You&apos;re on a team">
        Only the team leader can edit membership and select the PS. If you were added by mistake, contact your SPOC.
      </Alert>
      <Card>
        <CardHeader>
          <h2 className="text-xl font-bold">{team.teamName}</h2>
          <div className="text-sm text-slate-500 font-mono">{team.teamCode}</div>
        </CardHeader>
        <CardBody>
          <div className="text-sm">
            <div className="font-semibold">Leader</div>
            <div>{team.leader.fullName} · {team.leader.rollNumber}</div>
          </div>
          <div className="mt-4 grid gap-2 text-sm">
            {team.members.map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded border border-slate-200 p-2">
                <div>{m.student.fullName} · <span className="text-slate-500">{m.student.rollNumber}</span></div>
                <Badge>{m.role}</Badge>
              </div>
            ))}
          </div>
          {team.ps && (
            <div className="mt-6 rounded border border-slate-200 p-3 text-sm">
              <div className="text-xs text-slate-500">Selected PS</div>
              <div className="font-semibold">{team.ps.psNumber} — {team.ps.title}</div>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

// -------------------------------------------------------------------- Receipt
function RegistrationReceipt({ team }: { team: TeamView }) {
  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-6 text-white">
        <div className="text-xs uppercase tracking-widest opacity-80">Registration successful</div>
        <div className="mt-1 text-2xl font-bold">{team.teamName}</div>
        <div className="mt-1 font-mono text-sm opacity-90">{team.teamCode}</div>
        <div className="mt-3 text-sm">
          Registered at {team.submittedAt ? new Date(team.submittedAt).toLocaleString() : "—"} · Status <b>{team.status}</b>
        </div>
      </div>

      <Card>
        <CardHeader><h3 className="font-semibold">Members</h3></CardHeader>
        <CardBody>
          <ol className="space-y-2">
            {team.members.map((m, i) => (
              <li key={m.id} className="flex items-center justify-between rounded border border-slate-200 p-3 text-sm">
                <div>
                  <span className="mr-2 font-mono text-xs text-slate-400">#{i + 1}</span>
                  {m.student.fullName} · {m.student.rollNumber}
                  <span className="ml-2 text-xs text-slate-500">{m.student.cohort.displayName}</span>
                </div>
                <div className="flex gap-1">
                  {m.role === "LEADER" && <Badge tone="info">Leader</Badge>}
                  {m.student.gender === "FEMALE" && <Badge tone="success">F</Badge>}
                </div>
              </li>
            ))}
          </ol>
        </CardBody>
      </Card>

      {team.ps && (
        <Card>
          <CardHeader><h3 className="font-semibold">Problem statement</h3></CardHeader>
          <CardBody>
            <div className="font-mono text-sm text-slate-500">{team.ps.psNumber}</div>
            <div className="text-lg font-semibold">{team.ps.title}</div>
            <div className="text-sm text-slate-600">{team.ps.organization}</div>
            <div className="mt-1 text-xs text-slate-500">{team.ps.theme} · {team.ps.category}</div>
          </CardBody>
        </Card>
      )}

      <Alert tone="info" title="This team is locked">
        Only the SPOC can unlock this team. Contact them if a member needs to be replaced or if any detail is wrong.
      </Alert>
    </div>
  );
}
