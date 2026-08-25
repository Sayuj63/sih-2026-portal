import Link from "next/link";
import Image from "next/image";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui";
import { config } from "@/lib/config";

export default function Home() {
  return (
    <AppShell
      kind="public"
      actions={
        <a href="https://www.sih.gov.in/letters/2026/SIH%202026%20Guidelines.pdf" target="_blank" rel="noopener" className="text-slate-700 hover:text-indigo-600">Guidelines ↗</a>
      }
    >
      <div className="mx-auto max-w-6xl px-4 py-8 sm:py-14">
        <section className="grid gap-10 md:grid-cols-[3fr_2fr] items-center">
          <div>
            <Badge tone="info">Smart India Hackathon 2026</Badge>
            <h1 className="mt-4 text-3xl sm:text-5xl font-black tracking-tight text-slate-900">
              {config.college.name} Internal Hackathon Registration
            </h1>
            <p className="mt-4 text-slate-600 max-w-prose text-base sm:text-lg">
              Register your six-member team for the college internal hackathon that qualifies teams for official SIH 2026 nomination.
              Direct form entry — no OTP, no login. Guidelines are shown inline as you fill it out.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/register" className="rounded-md bg-indigo-600 px-5 py-3 text-white font-semibold shadow-sm hover:bg-indigo-700">
                Register your team →
              </Link>
              <a
                href="/SIH2026-Idea-Presentation-Template.pptx"
                download
                className="rounded-md bg-amber-500 px-5 py-3 text-white font-semibold shadow-sm hover:bg-amber-600"
              >
                ⬇ Download PPT template
              </a>
              <a
                href="https://www.sih.gov.in/"
                target="_blank"
                rel="noopener"
                className="rounded-md border border-slate-300 bg-white px-5 py-3 font-semibold hover:bg-slate-50"
              >
                Official SIH portal ↗
              </a>
            </div>

            <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <b>Every team must use the official SIH 2026 idea-presentation template.</b> Download the .pptx above — you&apos;ll submit the filled-in six-slide PDF later on the official SIH portal, not here.
            </div>

            <div className="mt-8 grid sm:grid-cols-2 gap-4 text-sm">
              <FactCard title={`Team of ${config.team.size}`} body={`Exactly ${config.team.size} members including the team leader. Cross-cohort teams welcome.`} />
              <FactCard title={`${config.team.minFemaleMembers}+ female member${config.team.minFemaleMembers > 1 ? "s" : ""}`} body="Required by the SIH 2026 guidelines." />
              <FactCard title={`@${config.college.emailDomain} email`} body="Every member's email must be the official college address." />
              <FactCard title="One PS, many teams" body="Multiple teams can pick the same SIH problem statement — that is by design." />
            </div>
          </div>

          <aside className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <Image
              src="/sih-timeline.png"
              alt="SIH 2026 timeline"
              width={1200}
              height={800}
              className="w-full h-auto rounded"
              priority
            />
            <p className="mt-3 text-xs text-slate-500 text-center">
              Timeline · Registration & internal hackathon Jun–Aug 2026 · Grand Finale Dec 2026.
            </p>
          </aside>
        </section>
      </div>
    </AppShell>
  );
}

function FactCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="font-semibold">{title}</div>
      <div className="text-slate-600 mt-0.5">{body}</div>
    </div>
  );
}
