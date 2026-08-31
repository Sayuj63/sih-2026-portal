"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, CardBody, CardHeader, Field, Input, Select } from "@/components/ui";
import { api } from "@/lib/client-fetch";

type Initial = {
  teamName: string;
  teamCode: string;
  status: string;
  psNumber: string;
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

export function EditTeamForm({ teamId, initial }: { teamId: string; initial: Initial }) {
  const router = useRouter();
  const [teamName, setTeamName] = useState(initial.teamName);
  const [teamCode, setTeamCode] = useState(initial.teamCode);
  const [status, setStatus] = useState(initial.status);
  const [psNumber, setPsNumber] = useState(initial.psNumber);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setBusy(true);
    const r = await api<{ team: { id: string } }>(`/api/sayuj/teams/${teamId}/edit`, {
      method: "POST",
      body: JSON.stringify({
        teamName: teamName.trim(),
        teamCode: teamCode.trim(),
        status,
        psNumber: psNumber.trim(),
        reason: reason.trim() || undefined,
      }),
    });
    setBusy(false);
    if (!r.ok) {
      setError(r.error.message);
      return;
    }
    setSuccess("Team updated.");
    router.refresh();
    router.push(`/sayuj/teams/${teamId}`);
  }

  return (
    <Card>
      <CardHeader><h2 className="font-semibold">Team fields</h2></CardHeader>
      <CardBody>
        <form onSubmit={onSubmit} className="space-y-4">
          {error && <Alert tone="danger">{error}</Alert>}
          {success && <Alert tone="success">{success}</Alert>}

          <Field label="Team name">
            <Input value={teamName} onChange={(e) => setTeamName(e.target.value)} required maxLength={60} />
          </Field>

          <Field label="Team code" hint="Human-readable code (e.g. ISU-SIH-4100).">
            <Input value={teamCode} onChange={(e) => setTeamCode(e.target.value)} required maxLength={32} />
          </Field>

          <Field label="Status">
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
          </Field>

          <Field label="Problem statement number" hint="Leave blank to clear the assignment.">
            <Input value={psNumber} onChange={(e) => setPsNumber(e.target.value)} maxLength={32} placeholder="e.g. SIH2026-001" />
          </Field>

          <Field label="Reason (optional, written to audit log)">
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Fixed team name typo per leader request" />
          </Field>

          <div className="flex justify-end gap-2">
            <Button type="submit" variant="primary" loading={busy} disabled={busy}>
              Save changes
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
