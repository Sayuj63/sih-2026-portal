import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { RegistrationForm } from "./RegistrationForm";
import { config } from "@/lib/config";

export const dynamic = "force-dynamic";

const COHORTS = [
  { batchYear: 2023, label: "Steve Jobs — 4th year" },
  { batchYear: 2024, label: "Mark Zuckerberg — 3rd year" },
  { batchYear: 2025, label: "Sam Altman — 2nd year" },
  { batchYear: 2026, label: "Tim Cook — 1st year" },
];

export default function RegisterPage() {
  return (
    <AppShell kind="public" actions={<Link href="/" className="text-slate-700 hover:text-indigo-600">Home</Link>}>
      <div className="mx-auto max-w-3xl px-4 py-8 sm:py-10">
        <div className="mb-6">
          <div className="text-xs uppercase tracking-widest text-indigo-600 font-semibold">Smart India Hackathon 2026</div>
          <h1 className="mt-1 text-3xl font-black tracking-tight">{config.college.name} Internal Team Registration</h1>
          <p className="mt-2 text-slate-600">Fill in your team details, review the guidelines inline, and submit. That&apos;s it — no OTP, no login.</p>
        </div>

        <RegistrationForm
          cohorts={COHORTS}
          collegeEmailDomain={config.college.emailDomain}
          teamSize={config.team.size}
          minFemale={config.team.minFemaleMembers}
        />
      </div>
    </AppShell>
  );
}
