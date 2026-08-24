# SIH 2026 — ISU Internal Hackathon Registration Portal

A server-authoritative team-registration portal for the college internal hackathon that qualifies teams for Smart India Hackathon 2026 nomination. This replaces a fragile Google Form workflow with a proper institutional system.

Everything a technically capable student could try to spoof — email domain, roll numbers, cohort, gender, one-team-per-student, team-name uniqueness, PS legitimacy, deadlines — is validated on the server against a trusted directory, and enforced at the database layer via unique constraints and transactions.

## What this portal does

- **Student flow**: OTP login → guidelines → create team → look up 6 members by cohort+roll (never free-text) → look up PS by number → review → final register → registration receipt.
- **Admin flow**: dashboard KPIs, teams list with filters, team detail with audit history, approve / reject / unlock, PS analytics, student directory browse, deadline mode switcher (OPEN / PAUSED / CLOSED), full audit log.
- **Anti-gaming**: exact `@isu.ac.in` domain match; cohort-scoped roll uniqueness; single active team per student enforced by DB constraint; team-name normalization + institute-name blacklist; PS lookup against the trusted catalogue; atomic finalize with idempotency key + optimistic version check; race-safe against concurrent registrations.

## Stack

- **Next.js 16** (App Router, React 19, Turbopack)
- **TypeScript** strict, **Tailwind CSS 4**
- **Prisma 7** with **SQLite** via `@prisma/adapter-better-sqlite3`
- **iron-session** for cookie sessions (HttpOnly, SameSite=Lax, Secure in prod)
- **@node-rs/argon2** for admin password hashing
- **Zod** for request validation

## Getting started

```bash
npm install
cp .env.example .env    # then edit SESSION_SECRET and OTP_PEPPER
npx prisma migrate dev
npx tsx prisma/seed.ts
npm run dev
```

The seed creates:
- ISU college
- 4 cohorts: **Steve Jobs (2023)**, **Mark Zuckerberg (2024)**, **Sam Altman (2025)**, **Tim Cook (2026)**
- 27 students across genders, branches, and cohorts (deliberately with **shared roll numbers across cohorts** to exercise the `UNIQUE(cohort_id, roll)` rule)
- 20 sample SIH 2026 problem statements
- One super admin: `spoc` / `ChangeMe#SIH2026`

In development, OTP codes are printed to the server console. Set `DEV_ECHO_OTP=false` in production and wire up SMTP.

## Demo login

Try the wizard end-to-end:

1. Open http://localhost:3000
2. Click **Student login**
3. Enter `sayuj.cse101@isu.ac.in` → the OTP prints in the dev terminal
4. Create team **Nebula**, acknowledge guidelines
5. Add 5 more members by cohort + roll (mix cohorts to prove cross-cohort teams work). At least one member must be female — e.g. `Mark Zuckerberg + CSE102 (Ananya)`.
6. Look up PS `SIH-2026-1401` and select it
7. Register

For the admin side, sign in at http://localhost:3000/admin/login as `spoc` / `ChangeMe#SIH2026`.

## Try to break it

The security model is the point. All of these are already blocked at the API layer — try them yourself:

| Attempt                                           | Expected behaviour                                                |
|---------------------------------------------------|-------------------------------------------------------------------|
| `POST /api/auth/student/otp` with `@gmail.com`    | `Only isu.ac.in email addresses are accepted.`                    |
| Domain trick `x@isu.ac.in.evil.com`               | Same rejection — exact-match, no substring                        |
| Request the same OTP repeatedly                   | Rate limited after 5 requests / 15 min per email                  |
| Register two teams as the same leader             | `You already lead a registered team.`                             |
| Add a student who is already on another team      | Rejected by `UNIQUE(studentId, isActive)` constraint              |
| Add the same student twice within one team        | Rejected                                                          |
| Create two teams with the same name (different case, extra spaces) | Rejected via normalized `UNIQUE(collegeId, normalizedTeamName)` |
| Team name `ISU Rockets`                           | Rejected — institute-name blacklist                               |
| Look up PS `HACK-9999`                            | 404                                                               |
| Multiple teams pick `SIH-2026-1401`               | All succeed — this is by design                                   |
| Double-click **Register team**                    | One registration (idempotency key)                                |
| Adjust your browser clock to bypass the deadline  | No effect — server clock is authoritative                         |

## Spec references

The full specification is at `../SIH_2026_Internal_Hackathon_Registration_Portal_FINAL.md`. Key sections wired into the code:

- **§7–§11 identity**: `validation.ts::requireCollegeEmail`, `normalizeEmail`, `normalizeRollNumber`, `normalizeName`
- **§18 one active team**: `TeamMember @@unique([studentId, isActive])`
- **§23–§24 team name**: `validation.ts::validateTeamName` + `Team @@unique([collegeId, normalizedTeamName])`
- **§27–§32 PS lookup**: `api/ps/lookup`, `TeamProblemStatement @@unique([teamId, psId])`, `@@unique([teamId])`
- **§47–§49 atomic finalize + race safety**: `api/team/finalize/route.ts` with idempotency + version check
- **§56 role escalation**: server-derived `admin.role` from DB
- **§60 rate limiting**: `rate-limit.ts` with per-email + per-IP buckets
- **§76 historical snapshot**: `TeamSnapshot` written inside the finalize transaction
- **§107 deadline**: `isWithinRegistrationWindow()` uses server time only
- **§118 data integrity checklist**: mirrored in `team-service.ts::validateForFinalize`

## Deploy

The default SQLite setup runs on Vercel but is ephemeral — for production, swap `DATABASE_URL` to a persistent Postgres (Neon, Vercel Postgres, Supabase) and update `prisma/schema.prisma`'s provider to `postgresql`. All queries are Prisma-agnostic.

## License

Private — for ISU internal use.
