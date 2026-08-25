import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { RegistrationForm } from "./RegistrationForm";
import { config } from "@/lib/config";
import { prisma } from "@/lib/db";
import { getCollege } from "@/lib/college";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const college = await getCollege();
  const cohorts = await prisma.cohort.findMany({
    where: { collegeId: college.id, isActive: true },
    orderBy: [{ batchYear: "asc" }, { displayName: "asc" }],
    select: { id: true, slug: true, batchYear: true, displayName: true, program: true, yearOfStudy: true },
  });

  return (
    <AppShell kind="public" actions={<Link href="/" className="text-slate-700 hover:text-indigo-600">Home</Link>}>
      <div className="mx-auto max-w-3xl px-4 py-8 sm:py-10">
        <div className="mb-6">
          <div className="text-xs uppercase tracking-widest text-indigo-600 font-semibold">Smart India Hackathon 2026</div>
          <h1 className="mt-1 text-3xl font-black tracking-tight">{config.college.name} Internal Team Registration</h1>
          <p className="mt-2 text-slate-600">Fill in your team details, review the guidelines inline, and submit. That&apos;s it — no OTP, no login.</p>
        </div>

        <RegistrationForm
          cohorts={cohorts}
          collegeEmailDomain={config.college.emailDomain}
          teamSize={config.team.size}
          minFemale={config.team.minFemaleMembers}
        />
      </div>
    </AppShell>
  );
}
