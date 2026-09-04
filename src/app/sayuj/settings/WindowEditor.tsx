"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Input } from "@/components/ui";
import { api } from "@/lib/client-fetch";

// Format a UTC ISO string as a `datetime-local` value (YYYY-MM-DDTHH:mm) in the given IANA timezone.
function isoToLocalInput(iso: string, tz: string): string {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d);
  const m: Record<string, string> = {};
  for (const p of parts) m[p.type] = p.value;
  const hh = m.hour === "24" ? "00" : m.hour;
  return `${m.year}-${m.month}-${m.day}T${hh}:${m.minute}`;
}

// Interpret a `datetime-local` value as wall-clock in the given IANA timezone and return a UTC ISO string.
function localInputToIso(local: string, tz: string): string {
  const asUtc = new Date(local + ":00Z");
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(asUtc);
  const m: Record<string, string> = {};
  for (const p of parts) m[p.type] = p.value;
  const asIfTz = Date.UTC(+m.year, +m.month - 1, +m.day, +m.hour === 24 ? 0 : +m.hour, +m.minute, +m.second);
  const offset = asIfTz - asUtc.getTime();
  return new Date(asUtc.getTime() - offset).toISOString();
}

export function WindowEditor({
  openAtIso,
  closeAtIso,
  timezone,
}: {
  openAtIso: string;
  closeAtIso: string;
  timezone: string;
}) {
  const router = useRouter();
  const initialOpen = useMemo(() => isoToLocalInput(openAtIso, timezone), [openAtIso, timezone]);
  const initialClose = useMemo(() => isoToLocalInput(closeAtIso, timezone), [closeAtIso, timezone]);
  const [openLocal, setOpenLocal] = useState(initialOpen);
  const [closeLocal, setCloseLocal] = useState(initialClose);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const dirty = openLocal !== initialOpen || closeLocal !== initialClose;

  async function save() {
    setError(null);
    setSaved(false);
    if (!openLocal || !closeLocal) {
      setError("Both dates are required.");
      return;
    }
    const openIso = localInputToIso(openLocal, timezone);
    const closeIso = localInputToIso(closeLocal, timezone);
    if (new Date(openIso) >= new Date(closeIso)) {
      setError("Opens must be before Closes.");
      return;
    }
    setBusy(true);
    const r = await api("/api/sayuj/settings/window", {
      method: "POST",
      body: JSON.stringify({ openAt: openIso, closeAt: closeIso }),
    });
    setBusy(false);
    if (!r.ok) {
      setError(r.error.message);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
      {error && <Alert tone="danger">{error}</Alert>}
      {saved && !error && <Alert tone="success">Registration window updated.</Alert>}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs uppercase tracking-wider text-slate-500">Opens ({timezone})</span>
          <Input
            type="datetime-local"
            value={openLocal}
            onChange={(e) => { setOpenLocal(e.target.value); setSaved(false); }}
            className="mt-1"
          />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-wider text-slate-500">Closes ({timezone})</span>
          <Input
            type="datetime-local"
            value={closeLocal}
            onChange={(e) => { setCloseLocal(e.target.value); setSaved(false); }}
            className="mt-1"
          />
        </label>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="primary" loading={busy} onClick={save} disabled={busy || !dirty}>Save window</Button>
        {dirty && !busy && (
          <Button
            variant="secondary"
            onClick={() => { setOpenLocal(initialOpen); setCloseLocal(initialClose); setError(null); setSaved(false); }}
          >Reset</Button>
        )}
      </div>
    </div>
  );
}
