import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui";
import { config } from "@/lib/config";

const TIMELINE = [
  { label: "Registration of SPOCs",                            when: "Jun–Aug 2026" },
  { label: "Internal Hackathon",                               when: "Jun–Aug 2026" },
  { label: "SIH Problem Statement Launch",                     when: "Jul–Aug 2026" },
  { label: "Internal Hackathon Report Compilation & Upload",   when: "Jul–Aug 2026" },
  { label: "Nomination of Top Teams & Submission of Ideas",    when: "Aug–Sep 2026" },
  { label: "Screening of Ideas",                               when: "Sep–Oct 2026" },
  { label: "Result Publication",                               when: "Oct 2026"     },
  { label: "Communication of Result",                          when: "Nov 2026"     },
  { label: "Mentoring & Training",                             when: "Nov 2026"     },
  { label: "Shortlist Announcement",                           when: "Nov 2026"     },
  { label: "Grand Finale",                                     when: "Dec 2026"     },
];

export default function Home() {
  return (
    <AppShell
      kind="public"
      actions={
        <>
          <Link href="/login" className="text-slate-700 hover:text-indigo-600">Student login</Link>
          <Link href="/admin/login" className="rounded-md border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-50">Admin</Link>
        </>
      }
    >
      <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
        <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <b>Live demo</b> — sign in as <code className="rounded bg-white/70 px-1">sayuj.cse101@isu.ac.in</code> (or any seeded student — see the <a className="underline" href="https://github.com/Sayuj63/sih-2026-portal#demo-login" target="_blank" rel="noopener">seeded roster</a>). In demo mode the OTP is displayed on-screen so you can complete the flow without email. Admin credentials are provided to the ISU SPOC separately.
        </div>

        <section className="grid gap-8 md:grid-cols-[3fr_2fr] items-start">
          <div>
            <Badge tone="info">Smart India Hackathon 2026</Badge>
            <h1 className="mt-4 text-3xl sm:text-4xl font-black tracking-tight text-slate-900">
              {config.college.name} Internal Hackathon Registration
            </h1>
            <p className="mt-4 text-slate-600 max-w-prose">
              Register your six-member team for the college internal hackathon that qualifies teams for
              official SIH 2026 nomination. All identity, roll numbers, and problem statements are
              validated against the college directory — no ambiguity, no duplicate teams, no fake data.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/login" className="rounded-md bg-indigo-600 px-4 py-2 text-white font-medium hover:bg-indigo-700">
                Start / Continue registration
              </Link>
              <Link href="/guidelines" className="rounded-md border border-slate-300 bg-white px-4 py-2 font-medium hover:bg-slate-50">
                Read guidelines
              </Link>
              <a
                href="https://www.sih.gov.in/letters/2026/SIH%202026%20Guidelines.pdf"
                target="_blank"
                rel="noopener"
                className="rounded-md border border-slate-300 bg-white px-4 py-2 font-medium hover:bg-slate-50"
              >
                Official SIH 2026 PDF ↗
              </a>
            </div>

            <div className="mt-8 grid sm:grid-cols-2 gap-4 text-sm">
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="font-semibold">Team of {config.team.size}</div>
                <div className="text-slate-600">Exactly {config.team.size} members including the team leader. Cross-cohort teams allowed.</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="font-semibold">{config.team.minFemaleMembers}+ female member{config.team.minFemaleMembers > 1 ? "s" : ""}</div>
                <div className="text-slate-600">Enforced from the college roster — never editable from the browser.</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="font-semibold">@{config.college.emailDomain} email only</div>
                <div className="text-slate-600">Verified via one-time-passcode sent to your college address.</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="font-semibold">One PS, many teams</div>
                <div className="text-slate-600">Multiple teams can pick the same SIH problem statement — that&apos;s allowed by design.</div>
              </div>
            </div>
          </div>

          <aside className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="font-semibold">Internal timeline</h3>
            <ol className="mt-3 space-y-2 text-sm">
              {TIMELINE.map((row) => (
                <li key={row.label} className="flex justify-between gap-4 border-b border-slate-100 py-1.5 last:border-b-0">
                  <span>{row.label}</span>
                  <span className="text-slate-500 shrink-0">{row.when}</span>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-xs text-slate-500">
              Dates are indicative — controlled by the SPOC and enforced server-side. The browser clock is never trusted.
            </p>
          </aside>
        </section>
      </div>
    </AppShell>
  );
}
