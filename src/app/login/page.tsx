"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Alert, Button, Card, CardBody, Field, Input } from "@/components/ui";
import { api } from "@/lib/client-fetch";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function requestOtp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    const r = await api<{ sent: true; ttlSec: number; devOtp?: string }>("/api/auth/student/otp", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
    setBusy(false);
    if (!r.ok) {
      setError(r.error.message);
      return;
    }
    if (r.data.devOtp) {
      setInfo(`Demo mode — your OTP is ${r.data.devOtp}. In production this is emailed to ${email}.`);
      setOtp(r.data.devOtp);
    } else {
      setInfo(`If ${email} is a registered college address, a 6-digit code has been sent.`);
    }
    setStep("otp");
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await api<{ studentId: string; name: string }>("/api/auth/student/verify", {
      method: "POST",
      body: JSON.stringify({ email, otp }),
    });
    setBusy(false);
    if (!r.ok) {
      setError(r.error.message);
      return;
    }
    router.push("/team");
    router.refresh();
  }

  return (
    <AppShell kind="public" actions={<Link href="/" className="text-slate-700 hover:text-indigo-600">Home</Link>}>
      <div className="mx-auto max-w-md px-4 py-10">
        <Card>
          <CardBody>
            <h1 className="text-xl font-bold">Student sign-in</h1>
            <p className="mt-1 text-sm text-slate-500">Verify your college email to continue.</p>

            {error && <div className="mt-4"><Alert tone="danger">{error}</Alert></div>}
            {info && <div className="mt-4"><Alert tone="info">{info}</Alert></div>}

            {step === "email" && (
              <form className="mt-6 space-y-4" onSubmit={requestOtp}>
                <Field label="College email">
                  <Input
                    type="email"
                    required
                    autoFocus
                    autoComplete="email"
                    placeholder="you@isu.ac.in"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </Field>
                <Button type="submit" loading={busy} className="w-full">Send code</Button>
              </form>
            )}

            {step === "otp" && (
              <form className="mt-6 space-y-4" onSubmit={verifyOtp}>
                <Field label="Six-digit code">
                  <Input
                    inputMode="numeric"
                    pattern="\d{6}"
                    maxLength={6}
                    required
                    autoFocus
                    placeholder="123456"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  />
                </Field>
                <div className="flex gap-2">
                  <Button type="submit" loading={busy} className="flex-1">Verify & sign in</Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setStep("email");
                      setOtp("");
                      setInfo(null);
                    }}
                  >Use a different email</Button>
                </div>
              </form>
            )}

            <p className="mt-6 text-xs text-slate-500">
              By continuing you agree that only registered <span className="font-medium">@isu.ac.in</span> addresses can access the portal.
            </p>
          </CardBody>
        </Card>
      </div>
    </AppShell>
  );
}
