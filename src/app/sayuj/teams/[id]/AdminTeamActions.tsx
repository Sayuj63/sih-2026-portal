"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, CardBody, CardHeader, Field, Input } from "@/components/ui";
import { api } from "@/lib/client-fetch";

export function AdminTeamActions({ teamId, status, locked }: { teamId: string; status: string; locked: boolean }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function act(action: "approve" | "reject" | "unlock", requireReason = false) {
    setError(null);
    if (requireReason && !reason.trim()) {
      setError("A reason is required for this action.");
      return;
    }
    setBusy(action);
    const r = await api(`/api/sayuj/teams/${teamId}/${action}`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
    setBusy(null);
    if (!r.ok) {
      setError(r.error.message);
      return;
    }
    router.refresh();
  }

  return (
    <Card>
      <CardHeader><h2 className="font-semibold">Actions</h2></CardHeader>
      <CardBody className="space-y-3">
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label="Reason (required for reject/unlock)">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Roll number correction requested by leader" />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="primary"
            loading={busy === "approve"}
            disabled={status === "APPROVED" || busy !== null}
            onClick={() => act("approve")}
          >Approve</Button>
          <Button
            variant="danger"
            loading={busy === "reject"}
            disabled={status === "REJECTED" || busy !== null}
            onClick={() => act("reject", true)}
          >Reject</Button>
          <Button
            variant="secondary"
            loading={busy === "unlock"}
            disabled={!locked || busy !== null}
            onClick={() => act("unlock", true)}
          >Unlock for correction</Button>
        </div>
      </CardBody>
    </Card>
  );
}
