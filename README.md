# SIH 2026 — ISU Internal Hackathon Registration Portal

A team-registration portal for the ISU internal hackathon that qualifies teams for Smart India Hackathon 2026 nomination. Replaces a Google Form with a proper institutional system: server-authoritative validation, a persistent Postgres, an audit log, and a private SPOC console.

**Live:** [sih-2026-portal.vercel.app](https://sih-2026-portal.vercel.app)

---

## What the portal does

**Students** — one scrollable page at `/register`:
1. Team details (name + PS number + optional PS title)
2. Guidelines rendered inline (SIH rules + college-specific rules + ISU cohorts)
3. Six member cards (name, cohort, roll, branch, gender, college email) — first row is the team leader
4. Timeline reference image
5. Acknowledge + submit

No login, no OTP, no idea/PPT upload. Server validates and stores everything in one transaction. Success returns a signed team code (e.g. `ISU-SIH-4100`) and a receipt.

**SPOC / Admins** — dashboard at a private path (see internal setup docs, not linked publicly):
- KPIs, teams table with filters, per-team detail with full audit history
- Approve / Reject / Unlock (each requires a reason and is audited)
- PS analytics (which PS is selected by how many teams)
- Student directory browser
- OPEN / PAUSED / CLOSED registration-mode switch

---

## Anti-gaming rules (all server-side)

| Rule | How it's enforced |
|---|---|
| Only `@isu.ac.in` email | Exact-match domain check — not substring |
| Exactly 6 members | Zod + count check |
| ≥ 1 female member | Roster field, never editable from browser |
| Unique team name (case-insensitive, whitespace-collapsed) | `UNIQUE(collegeId, normalizedTeamName)` |
| Institute name in team name | Configurable blacklist |
| One active team per student | `UNIQUE(studentId, isActive)` — DB catches races |
| Roll number unique **within** cohort | `UNIQUE(cohortId, normalizedRollNumber)` — same roll across cohorts is legal |
| PS record must exist | Trusted `problem_statements` table |
| Multiple teams can pick the same PS | By design (spec §29) |
| Same team picking same PS twice | `UNIQUE(teamId, psId)` |
| Deadlines | Server clock only — browser clock is never trusted |
| Rate limits | Per-IP fixed-window bucket for `/api/register` |
| Admin password | Argon2 hash |
| Admin session | `iron-session` cookie: HttpOnly, SameSite=Lax, Secure in prod |
| Every mutation | Written to `AuditLog` with actor, resource, before/after, IP |
| Final registration | Single Prisma `$transaction` + optimistic version check |

---

## Stack

- **Next.js 16** (App Router, React 19, Turbopack)
- **TypeScript** strict, **Tailwind CSS 4**
- **Prisma 7** with `@prisma/adapter-pg`
- **Supabase Postgres** (pgbouncer-pooled, wired via the Vercel Supabase integration)
- **iron-session** for admin session cookies
- **@node-rs/argon2** for admin password hashing
- **Zod** for request validation
- Hosted on **Vercel** (Hobby tier)

---

## Local development

```bash
# 1. Clone
git clone git@github.com:Sayuj63/sih-2026-portal.git
cd sih-2026-portal
npm install

# 2. Configure
cp .env.example .env
# Fill in DATABASE_URL (any Postgres — Supabase, Neon, local pg), SESSION_SECRET, OTP_PEPPER

# 3. Migrate + seed the demo dataset
npx prisma migrate deploy
npm run seed

# 4. Run
npm run dev
```

The seed creates:
- ISU college with `@isu.ac.in` domain
- **11 cohorts**: Steve Jobs (2023); Mark Zuckerberg, Elon Musk, Jensen Huang (2024, BTech CSE); Sam Altman, Larry Page, Jeff Bezos, Demis Hassabis (2025, BTech CSE); Tim Cook, Andrew NG, Jerry Sanders (2026, BTech CSE & AI)
- 20 sample students
- 20 sample SIH 2026 problem statements
- 1 super admin (`spoc` / default password from `ADMIN_SEED_PASSWORD` env)

---

## Deployment (Vercel + Supabase)

The live deployment is a Vercel Hobby project connected via the Supabase marketplace integration. Once installed, Vercel injects `POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING`, and the Supabase key set into all environments automatically. Migrations run against the direct (non-pooling) URL; runtime uses the pooled URL.

Every push to `main` triggers a production build that runs `prisma migrate deploy` before `next build`.

---

## Project layout

```
prisma/
  schema.prisma        # single source of truth for the data model
  seed.ts              # college + cohorts + demo students + PS + admin
  migrations/          # generated migration history

src/
  app/
    page.tsx           # landing page (timeline image + register CTA)
    register/          # single-page team registration form + inline guidelines
    sayuj/             # admin console (login, dashboard, teams, students, PS, audit, settings)
    api/
      register/        # POST — atomic team + members + PS + snapshot
      public/cohorts/  # GET  — populates the cohort dropdown
      auth/sayuj/      # admin login + logout
      sayuj/           # admin actions (approve/reject/unlock, mode switch)
  components/
    AppShell.tsx       # shared chrome (header + footer)
    ui.tsx             # Tailwind primitives
  lib/
    config.ts          # runtime config; normalizes Supabase's sslmode
    db.ts              # Prisma client + pg adapter
    session.ts         # iron-session helpers
    auth-guard.ts      # server-side admin guard
    validation.ts      # email/roll/team-name normalization + Zod schemas
    team-service.ts    # team queries + validateForFinalize()
    audit.ts           # append-only audit log
    rate-limit.ts      # fixed-window per-key bucket
    college.ts         # single-tenant helpers + registration mode
    team-code.ts       # ISU-SIH-XXXX allocator
    http.ts            # JSON response helpers
    client-fetch.ts    # tiny fetch wrapper
```

---

## License

Private — for ISU internal use.
