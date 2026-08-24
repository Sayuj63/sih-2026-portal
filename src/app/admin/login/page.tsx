"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Alert, Button, Card, CardBody, Field, Input } from "@/components/ui";
import { api } from "@/lib/client-fetch";

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await api<{ role: string; name: string }>("/api/auth/admin/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    setBusy(false);
    if (!r.ok) {
      setError(r.error.message);
      return;
    }
    router.push("/admin");
    router.refresh();
  }

  return (
    <AppShell kind="public" actions={<Link href="/" className="text-slate-700">Home</Link>}>
      <div className="mx-auto max-w-md px-4 py-10">
        <Card>
          <CardBody>
            <h1 className="text-xl font-bold">Admin sign-in</h1>
            <p className="mt-1 text-sm text-slate-500">SPOC / Super Admin access.</p>
            {error && <div className="mt-4"><Alert tone="danger">{error}</Alert></div>}
            <form onSubmit={submit} className="mt-6 space-y-4">
              <Field label="Username">
                <Input required value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
              </Field>
              <Field label="Password">
                <Input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
              </Field>
              <Button type="submit" loading={busy} className="w-full">Sign in</Button>
            </form>
          </CardBody>
        </Card>
      </div>
    </AppShell>
  );
}
