"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, CardBody, CardHeader, Field, Input, Select } from "@/components/ui";
import { api } from "@/lib/client-fetch";

type CohortOption = { id: string; displayName: string; batchYear: number; program: string };

type TeamFields = {
  teamName: string;
  teamCode: string;
  status: string;
  psNumber: string;
};

type MemberFields = {
  teamMemberId: string;
  studentId: string;
  role: string;
  fullName: string;
  rollNumber: string;
  cohortId: string;
  gender: string;
  branch: string;
  section: string;
  mobileNumber: string;
  collegeEmail: string;
};

type Initial = {
  team: TeamFields;
  members: MemberFields[];
};

const STATUS_OPTIONS = [
  "DRAFT",
  "READY",
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
  "LOCKED",
  "CORRECTION_REQUIRED",
  "WITHDRAWN",
] as const;

const GENDER_OPTIONS = ["MALE", "FEMALE", "OTHER"] as const;

export function EditTeamForm({
  teamId,
  cohorts,
  initial,
}: {
  teamId: string;
  cohorts: CohortOption[];
  initial: Initial;
}) {
  const router = useRouter();
  const [team, setTeam] = useState<TeamFields>(initial.team);
  const [members, setMembers] = useState<MemberFields[]>(initial.members);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function updateTeam<K extends keyof TeamFields>(key: K, value: TeamFields[K]) {
    setTeam((t) => ({ ...t, [key]: value }));
  }

  function updateMember(idx: number, patch: Partial<MemberFields>) {
    setMembers((prev) => prev.map((m, i) => (i === idx ? { ...m, ...patch } : m)));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setBusy(true);
    const r = await api<{ team: { id: string } }>(`/api/sayuj/teams/${teamId}/edit`, {
      method: "POST",
      body: JSON.stringify({
        team: {
          teamName: team.teamName.trim(),
          teamCode: team.teamCode.trim(),
          status: team.status,
          psNumber: team.psNumber.trim(),
        },
        members: members.map((m) => ({
          teamMemberId: m.teamMemberId,
          studentId: m.studentId,
          fullName: m.fullName.trim(),
          rollNumber: m.rollNumber.trim(),
          cohortId: m.cohortId,
          gender: m.gender,
          branch: m.branch.trim(),
          section: m.section.trim() || null,
          mobileNumber: m.mobileNumber.trim() || null,
          collegeEmail: m.collegeEmail.trim(),
        })),
        reason: reason.trim() || undefined,
      }),
    });
    setBusy(false);
    if (!r.ok) {
      setError(r.error.message);
      return;
    }
    setSuccess("Team + student records updated across the portal.");
    router.refresh();
    router.push(`/sayuj/teams/${teamId}`);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {error && <Alert tone="danger">{error}</Alert>}
      {success && <Alert tone="success">{success}</Alert>}

      <Card>
        <CardHeader>
          <h2 className="font-semibold">Team</h2>
        </CardHeader>
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Team name">
            <Input value={team.teamName} onChange={(e) => updateTeam("teamName", e.target.value)} required maxLength={60} />
          </Field>
          <Field label="Team code" hint="Human-readable code (e.g. ISU-SIH-4100).">
            <Input value={team.teamCode} onChange={(e) => updateTeam("teamCode", e.target.value)} required maxLength={32} />
          </Field>
          <Field label="Status">
            <Select value={team.status} onChange={(e) => updateTeam("status", e.target.value)}>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Problem statement number" hint="Leave blank to clear the assignment.">
            <Input value={team.psNumber} onChange={(e) => updateTeam("psNumber", e.target.value)} maxLength={32} placeholder="e.g. SIH2026-001" />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Members ({members.length})</h2>
            <span className="text-xs text-slate-500">Edits update the master student record, not just this team.</span>
          </div>
        </CardHeader>
        <CardBody className="space-y-5">
          {members.map((m, idx) => (
            <div key={m.teamMemberId} className="rounded-lg border border-slate-200 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-semibold">
                  #{idx + 1} {m.role === "LEADER" && <span className="ml-2 rounded bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">Leader</span>}
                </div>
                <div className="font-mono text-xs text-slate-400">student · {m.studentId.slice(0, 8)}</div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name">
                  <Input value={m.fullName} onChange={(e) => updateMember(idx, { fullName: e.target.value })} required maxLength={120} />
                </Field>
                <Field label="College email">
                  <Input
                    type="email"
                    value={m.collegeEmail}
                    onChange={(e) => updateMember(idx, { collegeEmail: e.target.value })}
                    required
                    maxLength={120}
                  />
                </Field>
                <Field label="Roll number">
                  <Input value={m.rollNumber} onChange={(e) => updateMember(idx, { rollNumber: e.target.value })} required maxLength={32} />
                </Field>
                <Field label="Cohort">
                  <Select value={m.cohortId} onChange={(e) => updateMember(idx, { cohortId: e.target.value })}>
                    {cohorts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.displayName} · {c.batchYear} · {c.program}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Gender">
                  <Select value={m.gender} onChange={(e) => updateMember(idx, { gender: e.target.value })}>
                    {GENDER_OPTIONS.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Branch">
                  <Input value={m.branch} onChange={(e) => updateMember(idx, { branch: e.target.value })} required maxLength={80} />
                </Field>
                <Field label="Section (optional)">
                  <Input value={m.section} onChange={(e) => updateMember(idx, { section: e.target.value })} maxLength={16} />
                </Field>
                <Field label="Mobile number (optional)">
                  <Input value={m.mobileNumber} onChange={(e) => updateMember(idx, { mobileNumber: e.target.value })} maxLength={20} />
                </Field>
              </div>
            </div>
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-3">
          <Field label="Reason (optional, written to audit log)">
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Fixed roll numbers per leader email 2026-08-31" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="submit" variant="primary" loading={busy} disabled={busy}>
              Save all changes
            </Button>
          </div>
        </CardBody>
      </Card>
    </form>
  );
}
