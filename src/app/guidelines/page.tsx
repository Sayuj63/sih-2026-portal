import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { config } from "@/lib/config";

export default function GuidelinesPage() {
  return (
    <AppShell
      kind="public"
      actions={
        <>
          <Link href="/" className="text-slate-700 hover:text-indigo-600">Home</Link>
          <Link href="/login" className="rounded-md border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-50">Student login</Link>
        </>
      }
    >
      <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12 space-y-6 text-sm leading-relaxed text-slate-700">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">SIH 2026 — Guidelines & Internal Hackathon Rules</h1>
          <p className="mt-2 text-slate-500">Read these before beginning registration.</p>
        </div>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">Team formation (official SIH)</h2>
          <ul className="mt-2 list-disc pl-6 space-y-1">
            <li>A team consists of <b>{config.team.size} members</b> including the team leader.</li>
            <li>At least <b>{config.team.minFemaleMembers} female team member</b> is mandatory.</li>
            <li>All members must be from the same college.</li>
            <li>Teams may include students from different cohorts/years.</li>
            <li>Team name must be unique and must <b>not</b> contain the institute name.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">College-specific rules</h2>
          <ul className="mt-2 list-disc pl-6 space-y-1">
            <li>Only <code className="text-xs bg-slate-100 rounded px-1">@{config.college.emailDomain}</code> email addresses are accepted.</li>
            <li>Student identity is resolved against the college directory. Roll numbers, cohort, gender and branch cannot be edited by students.</li>
            <li>Each student may belong to only one active internal-hackathon team.</li>
            <li>Multiple teams may select the same SIH Problem Statement — that is by design.</li>
            <li>Registration deadlines are set by the SPOC and enforced server-side.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">What this portal does <em>not</em> collect</h2>
          <p className="mt-2">This is registration only — idea title, description, PPT, PDF and prototype uploads are <b>not</b> collected here. Those belong to the next stage of the official SIH process.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">Reference for later idea submission</h2>
          <p className="mt-2">
            The official SIH 2026 idea-presentation template is a six-slide PDF submitted later on the official SIH portal. Download it for future reference:
            <a className="ml-1 text-indigo-600 underline" target="_blank" rel="noopener" href="https://www.sih.gov.in/letters/2026/SIH%202026%20Guidelines.pdf">SIH 2026 Guidelines PDF ↗</a>
          </p>
        </section>

        <div className="rounded-lg bg-indigo-50 border border-indigo-200 p-4 text-indigo-900">
          You&apos;ll be asked to acknowledge these guidelines when you create your team.
          <Link href="/login" className="ml-2 underline font-medium">Proceed to sign in →</Link>
        </div>
      </div>
    </AppShell>
  );
}
