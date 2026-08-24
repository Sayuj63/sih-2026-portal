"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button } from "@/components/ui";
import { api } from "@/lib/client-fetch";

const MODES = ["OPEN", "PAUSED", "CLOSED"] as const;
type Mode = typeof MODES[number];

export function ModeSwitcher({ current }: { current: Mode }) {
  const router = useRouter();
  const [busy, setBusy] = useState<Mode | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function set(mode: Mode) {
    setError(null);
    setBusy(mode);
    const r = await api("/api/admin/settings/mode", {
      method: "POST",
      body: JSON.stringify({ mode }),
    });
    setBusy(null);
    if (!r.ok) {
      setError(r.error.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="flex flex-wrap gap-2">
        {MODES.map((m) => (
          <Button
            key={m}
            variant={m === current ? "primary" : "secondary"}
            loading={busy === m}
            onClick={() => set(m)}
            disabled={busy !== null}
          >{m}</Button>
        ))}
      </div>
    </div>
  );
}
