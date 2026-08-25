"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Alert, Badge, Button, Card, CardBody, CardHeader, Field, Input, Select } from "@/components/ui";
import { api } from "@/lib/client-fetch";

type Cohort = { id: string; slug: string; batchYear: number; displayName: string; program: string; yearOfStudy: number };
type MemberForm = {
  fullName: string;
  rollNumber: string;
  cohortSlug: string;
  gender: "MALE" | "FEMALE" | "OTHER" | "";
  email: string;
  branch: string;
};

function emptyMember(defaultSlug: string): MemberForm {
  return { fullName: "", rollNumber: "", cohortSlug: defaultSlug, gender: "", email: "", branch: "" };
}

export function RegistrationForm({
  cohorts,
  collegeEmailDomain,
  teamSize,
  minFemale,
}: {
  cohorts: Cohort[];
  collegeEmailDomain: string;
  teamSize: number;
  minFemale: number;
}) {
  const defaultSlug = cohorts[0]?.slug ?? "";
  const [teamName, setTeamName] = useState("");
  const [psNumber, setPsNumber] = useState("");
  const [psTitle, setPsTitle] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [members, setMembers] = useState<MemberForm[]>(() =>
    Array.from({ length: teamSize }, () => emptyMember(defaultSlug)),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<null | { teamCode: string; teamName: string; registeredAt: string }>(null);

  const femaleCount = members.filter((m) => m.gender === "FEMALE").length;

  function setMember(i: number, patch: Partial<MemberForm>) {
    setMembers((prev) => prev.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!accepted) {
      setError("Please tick the guidelines acknowledgement to submit.");
      return;
    }
    for (let i = 0; i < members.length; i++) {
      const m = members[i];
      if (!m.fullName || !m.rollNumber || !m.gender || !m.email || !m.branch) {
        setError(`Please fill every field for Member ${i + 1}.`);
        return;
      }
    }
    if (femaleCount < minFemale) {
      setError(`Team must include at least ${minFemale} female member${minFemale > 1 ? "s" : ""}.`);
      return;
    }

    setBusy(true);
    const r = await api<{ teamCode: string; teamName: string; registeredAt: string }>("/api/register", {
      method: "POST",
      body: JSON.stringify({
        teamName,
        psNumber,
        psTitle: psTitle || undefined,
        guidelinesAccepted: accepted,
        members: members.map((m) => ({
          fullName: m.fullName,
          rollNumber: m.rollNumber,
          cohortSlug: m.cohortSlug,
          gender: m.gender,
          email: m.email,
          branch: m.branch,
        })),
      }),
    });
    setBusy(false);
    if (!r.ok) {
      setError(r.error.message);
      return;
    }
    setSuccess(r.data);
  }

  if (success) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-6 text-white">
          <div className="text-xs uppercase tracking-widest opacity-80">Registration successful</div>
          <div className="mt-1 text-2xl font-bold">{success.teamName}</div>
          <div className="mt-1 font-mono text-sm opacity-90">{success.teamCode}</div>
          <div className="mt-3 text-sm">Submitted {new Date(success.registeredAt).toLocaleString()}</div>
        </div>
        <Alert tone="info" title="What&apos;s next">
          Screenshot this receipt. The SPOC will contact your team leader for the internal-hackathon round. If any detail is wrong, email the SPOC — do not re-register.
        </Alert>
        <div className="flex gap-3">
          <Link href="/" className="rounded-md border border-slate-300 bg-white px-4 py-2">Back to home</Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      {/* -------- SECTION 1: Team details -------- */}
      <Card>
        <CardHeader>
          <SectionHead step={1} title="Team details" hint="Team name must be unique and cannot contain the institute name." />
        </CardHeader>
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Team name">
            <Input required minLength={3} maxLength={60} value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="e.g. Nebula" />
          </Field>
          <Field label="SIH Problem Statement number" hint="e.g. SIH-2026-1401 or SIH1401 — copy it from the official SIH portal.">
            <Input required maxLength={32} value={psNumber} onChange={(e) => setPsNumber(e.target.value.toUpperCase())} placeholder="SIH-2026-1401" />
          </Field>
          <Field label="PS title (optional)">
            <Input value={psTitle} onChange={(e) => setPsTitle(e.target.value)} placeholder="e.g. AI-Powered Crop Disease Prediction" />
          </Field>
        </CardBody>
      </Card>

      {/* -------- INLINE GUIDELINES BLOCK -------- */}
      <GuidelinesBlock collegeEmailDomain={collegeEmailDomain} teamSize={teamSize} minFemale={minFemale} />

      {/* -------- SECTION 2: Members -------- */}
      <Card>
        <CardHeader>
          <SectionHead step={2} title={`Team members (${teamSize})`} hint={`First member is the team leader. At least ${minFemale} female member${minFemale > 1 ? "s" : ""} required.`} />
        </CardHeader>
        <CardBody className="space-y-6">
          {members.map((m, i) => (
            <MemberBlock
              key={i}
              index={i}
              value={m}
              onChange={(patch) => setMember(i, patch)}
              cohorts={cohorts}
              collegeEmailDomain={collegeEmailDomain}
            />
          ))}
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm flex items-center justify-between">
            <div>
              <b>{teamSize}</b> members · <b>{femaleCount}</b> female
            </div>
            <Badge tone={femaleCount >= minFemale ? "success" : "warning"}>
              {femaleCount >= minFemale ? "Female requirement met" : `Need at least ${minFemale} female member${minFemale > 1 ? "s" : ""}`}
            </Badge>
          </div>
        </CardBody>
      </Card>

      {/* -------- INLINE TIMELINE IMAGE -------- */}
      <Card>
        <CardHeader>
          <SectionHead step={3} title="Where this fits in the SIH 2026 calendar" hint="Your college internal round precedes national screening." />
        </CardHeader>
        <CardBody>
          <div className="relative w-full overflow-hidden rounded-md border border-slate-200 bg-white">
            <Image
              src="/sih-timeline.png"
              alt="SIH 2026 timeline: SPOC registration → internal hackathon → PS launch → report upload → nomination → screening → result → mentoring → shortlist → grand finale."
              width={1200}
              height={800}
              className="w-full h-auto"
              priority
            />
          </div>
        </CardBody>
      </Card>

      {/* -------- ACKNOWLEDGE + SUBMIT -------- */}
      <Card>
        <CardBody className="space-y-4">
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
            />
            <span>
              I confirm that all six members are actual students of {" "}<b>{collegeName(collegeEmailDomain)}</b>, that the information above is accurate, and that I have read the <a href="#guidelines" className="underline text-indigo-700">guidelines above</a>.
            </span>
          </label>
          {error && <Alert tone="danger">{error}</Alert>}
          <div className="flex gap-3">
            <Button type="submit" loading={busy} disabled={!accepted}>Submit registration</Button>
            <Link href="/" className="inline-flex items-center px-4 py-2 text-sm text-slate-600 hover:text-slate-900">Cancel</Link>
          </div>
        </CardBody>
      </Card>
    </form>
  );
}

function collegeName(domain: string): string {
  return domain.split(".")[0].toUpperCase();
}

function groupCohorts(list: Cohort[]): Array<[number, Cohort[]]> {
  const map = new Map<number, Cohort[]>();
  for (const c of list) {
    const key = c.batchYear;
    const arr = map.get(key) ?? [];
    arr.push(c);
    map.set(key, arr);
  }
  return Array.from(map.entries()).sort(([a], [b]) => a - b);
}

function SectionHead({ step, title, hint }: { step: number; title: string; hint?: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white font-bold text-sm">{step}</span>
      <div>
        <h2 className="font-semibold text-lg">{title}</h2>
        {hint && <p className="text-xs text-slate-500 mt-0.5">{hint}</p>}
      </div>
    </div>
  );
}

function MemberBlock({
  index,
  value,
  onChange,
  cohorts,
  collegeEmailDomain,
}: {
  index: number;
  value: MemberForm;
  onChange: (patch: Partial<MemberForm>) => void;
  cohorts: Cohort[];
  collegeEmailDomain: string;
}) {
  const isLeader = index === 0;
  return (
    <div className={`rounded-lg border ${isLeader ? "border-indigo-300 bg-indigo-50/40" : "border-slate-200 bg-white"} p-4`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${isLeader ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700"}`}>{index + 1}</span>
          <div className="font-semibold text-sm">{isLeader ? "Team leader" : `Member ${index + 1}`}</div>
        </div>
        {isLeader && <Badge tone="info">Leader</Badge>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Full name">
          <Input required value={value.fullName} onChange={(e) => onChange({ fullName: e.target.value })} placeholder="e.g. Aarav Sharma" />
        </Field>
        <Field label="Cohort">
          <Select value={value.cohortSlug} onChange={(e) => onChange({ cohortSlug: e.target.value })} required>
            {cohorts.length === 0 && <option value="">No cohorts loaded</option>}
            {groupCohorts(cohorts).map(([year, list]) => (
              <optgroup key={year} label={`Batch ${year} · Year ${list[0].yearOfStudy}`}>
                {list.map((c) => (
                  <option key={c.slug} value={c.slug}>{c.displayName} — {c.program}</option>
                ))}
              </optgroup>
            ))}
          </Select>
        </Field>
        <Field label="Roll number">
          <Input required value={value.rollNumber} onChange={(e) => onChange({ rollNumber: e.target.value })} placeholder="e.g. CSE107" />
        </Field>
        <Field label="Branch">
          <Input required value={value.branch} onChange={(e) => onChange({ branch: e.target.value })} placeholder="e.g. CSE" />
        </Field>
        <Field label={`College email (@${collegeEmailDomain})`}>
          <Input required type="email" value={value.email} onChange={(e) => onChange({ email: e.target.value })} placeholder={`you@${collegeEmailDomain}`} />
        </Field>
        <Field label="Gender">
          <Select value={value.gender} onChange={(e) => onChange({ gender: e.target.value as MemberForm["gender"] })} required>
            <option value="" disabled>Select</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="OTHER">Other</option>
          </Select>
        </Field>
      </div>
    </div>
  );
}

function GuidelinesBlock({ collegeEmailDomain, teamSize, minFemale }: { collegeEmailDomain: string; teamSize: number; minFemale: number }) {
  return (
    <Card>
      <CardHeader>
        <div id="guidelines" className="flex items-center gap-3">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-700 font-bold">📖</span>
          <div>
            <h2 className="font-semibold text-lg">Guidelines — read before adding members</h2>
            <p className="text-xs text-slate-500 mt-0.5">Ministry-issued rules for the SIH 2026 team composition and college-specific policies.</p>
          </div>
        </div>
      </CardHeader>
      <CardBody className="text-sm text-slate-700 leading-relaxed space-y-4">
        <div>
          <h3 className="font-semibold text-slate-900">Official SIH 2026 team rules</h3>
          <ul className="mt-2 list-disc pl-6 space-y-1">
            <li>A team has exactly <b>{teamSize} members</b> including the team leader.</li>
            <li>At least <b>{minFemale} female team member</b> is mandatory.</li>
            <li>All members must belong to the <b>same college</b>.</li>
            <li>Cross-cohort teams are allowed — members can be from any batch year.</li>
            <li>Team name must be <b>unique</b> and must <b>not contain</b> the institute name.</li>
          </ul>
        </div>
        <div>
          <h3 className="font-semibold text-slate-900">College-specific rules</h3>
          <ul className="mt-2 list-disc pl-6 space-y-1">
            <li>Only <code className="rounded bg-slate-100 px-1">@{collegeEmailDomain}</code> email addresses are accepted.</li>
            <li>Each student can be part of <b>only one active team</b>. Duplicates are rejected on submit.</li>
            <li>Multiple teams may pick the <b>same SIH Problem Statement</b>. That&apos;s allowed by design.</li>
            <li>Once submitted, the team is locked. Contact the SPOC to correct a mistake.</li>
          </ul>
        </div>
        <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-amber-900 text-sm">
          <div className="font-bold mb-1">⬇ Download the official SIH 2026 idea-presentation template</div>
          <p className="text-xs">Every team fills this six-slide template later and uploads it as a PDF on the official SIH portal. It is <b>not</b> uploaded here — this portal is for team registration only.</p>
          <a
            href="/SIH2026-Idea-Presentation-Template.pptx"
            download
            className="mt-2 inline-flex items-center gap-2 rounded-md bg-amber-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-600"
          >
            Download SIH2026-Idea-Presentation-Template.pptx
          </a>
        </div>

        <div className="rounded-md bg-indigo-50 border border-indigo-200 p-3 text-indigo-900 text-xs">
          <b>Not required in this form:</b> idea title, description, PPT/PDF upload, prototype. Those belong to the later stage of the official SIH process.
          <a className="ml-1 underline" target="_blank" rel="noopener" href="https://www.sih.gov.in/letters/2026/SIH%202026%20Guidelines.pdf">Full SIH 2026 guidelines PDF ↗</a>
        </div>
      </CardBody>
    </Card>
  );
}
