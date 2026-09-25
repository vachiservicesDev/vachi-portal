# Vachi Portal

One-stop internal platform for Vachi Services: employee self-service +
immigration/HR compliance, for **admins** (HR/ops staff managing the
company's international-student, H-1B, other-visa, and citizen employees)
and **employees** (who log in to manage their own records) alike.

This is a **greenfield rebuild**, in its own repository, of the feature set
previously implemented in `vs-self-services-portal`. It is not a fork of
that repo and shares no git history with it — built fresh, same target
functionality, cleaner architecture. See "Status" below for what's actually
implemented today vs. still planned; this file is kept current as each
phase lands so there's never a hidden gap between what's described and
what's built.

## Full functionality scope

Every feature below is in scope for this project. ✅ = built and working
today, 🚧 = not yet built.

**Identity & access**
- ✅ Supabase Auth (admin/employee roles); authorization enforced in application code (`src/lib/auth/requireAdmin.ts` + explicit per-user scoping) since data access goes through Drizzle, not RLS — see "Architecture" below
- 🚧 SSO/MFA for admin accounts
- 🚧 Legacy-account one-time migration path (N/A — no legacy data here; will matter only if data is ever imported from the old system)

**Onboarding**
- ✅ Employee onboarding workflow: PDF document generation, e-signature via Dropbox Sign (sandbox), document storage in Supabase Storage. Vendor is swappable (DocuSign not yet chosen over Dropbox Sign — see docs/PLAN.md) and only one document type exists so far (a generic onboarding acknowledgment) — real forms (I-9 itself, offer letters, etc.) are added as more PDF generators following the same pattern.

**I-9 / E-Verify compliance**
- ✅ Digital Form I-9: Section 1 (employee self-entry, typed-name attestation), Section 2 (employer document verification, with a computed 3-business-day-from-hire due date), a combined PDF snapshot stored in Supabase Storage
- ✅ E-Verify case tracking — **manual entry, not a live DHS API call**: an admin creates the case in the real E-Verify portal (once enrolled) and records the case number/status here. See `src/lib/everify/manualProvider.ts` for why a live integration wasn't written blind against unverified government API documentation.
- 🚧 Section 3 reverification workflow (due date is computed off `employees.visa_expiry_date`, but there's no reminder/UI flow yet)
- 🚧 TNC (Tentative Nonconfirmation) workflow, I-9 retention-purge automation (the date is computed on termination but nothing acts on it yet), ICE/DOL audit export bundle
- Note: E-Verify itself has no cost to employers, but a live API integration requires enrolling as a DHS E-Verify employer (and employer agent, if running E-Verify on behalf of clients) first — a business/legal step, not a code dependency.

**Immigration & visa compliance**
- ✅ Visa expiry dashboard (`/admin/immigration`) — sorted by urgency (expired/critical ≤30d/warning ≤60d/ok), reads `employees.visa_expiry_date`. 🚧 No automated alerts yet (a scheduled scan is planned alongside Phase 7's notifications), and document-level expiry (the `documents` table) isn't joined in since that feature has no real data flowing through it yet
- ✅ STEM OPT I-983 Training Plan tracking (`/admin/stem-opt`, employee view at `/stem-opt`) — 12-month self-evaluation and final-evaluation due dates computed from the training start/end dates, admin marks each complete
- ✅ H-1B Public Access File (PAF) management (`/admin/paf`) — LCA case number, worksite, wage level/prevailing/actual wage, posting period. Admin/compliance-only, not employee-visible (it's a public-disclosure record, not personal data)
- ✅ Green card sponsorship pipeline (`/admin/green-card`, employee view at `/green-card`) — stage tracking through PERM → I-140 → I-485, priority date

**Training**
- ✅ One consolidated training system: task creation/assignment (`/admin/training`), employee completion tracking with comments (`/training`), weekly summaries (`/training/summaries`, admin review at `/admin/training/summaries`), performance reviews with employee acknowledgment (`/admin/reviews`, `/reviews`) — no legacy/v2 split this time, one design from the start
- 🚧 Real materials upload (a Storage-backed attachments subsystem) — today a task just links out via `contentUrl`
- 🚧 Quiz/assessment scoring (the `score` field exists on assignments but nothing computes it automatically)

**Timesheets & payroll**
- ✅ Timesheet submission/approval: employee logs daily entries and submits (`/timesheets`), admin approves/rejects (`/admin/timesheets`)
- ✅ Payroll — **manual entry, not a live provider integration**: no vendor chosen yet (Gusto/Check/ADP still open, see docs/PLAN.md), so admin records pay runs and pay stubs after running payroll elsewhere (`/admin/payroll`), employees view their stubs (`/payroll`). Swapping in a real provider adapter later follows the same pattern as `src/lib/everify`.

**Communication**
- ✅ Messaging between admin and employees (`/messages`) — live delivery via Supabase Realtime, the one place in the app where RLS is the actual runtime enforcement rather than defense-in-depth (see `supabase/rls-policies.sql`)
- ✅ In-app notifications (`/notifications`) — wired into a representative set of actions (training assignment, timesheet approve/reject, performance review submission); extend `src/lib/notifications/create.ts`'s call sites to cover more. 🚧 No email delivery yet, in-app only

**Admin**
- ✅ Middleware-protected admin/employee routing foundation
- ✅ Admin home dashboard (`/admin`) — pending onboarding, overdue I-9 Section 2s, timesheets/summaries awaiting review, visas expiring within 30 days, with links into each
- 🚧 Employee management, compliance dashboard, document oversight
- 🚧 Reporting (compliance, analytics) with CSV/PDF export
- ✅ Audit-log admin UI (`/admin/audit-log`) — but only a representative set of sensitive actions write to it today (I-9 Section 2 completion, timesheet approve/reject, green card stage changes); extend `src/lib/audit/log.ts`'s call sites for full coverage

**AI features** (Claude API, not just used as a dev tool)
- 🚧 Document intelligence: auto-extract fields from uploaded passport/EAD/I-20/I-797 during onboarding
- 🚧 Compliance assistant: chat grounded in the employee's own record
- 🚧 Risk surfacing: scheduled scan flags upcoming I-9 reverifications, PAF expirations, I-983 deadlines

## Architecture

- **Next.js 14** (App Router), TypeScript, Tailwind — one deploy unit (Vercel), no separate frontend/backend split.
- **Supabase**: Postgres + native Auth + Storage + Realtime. One project, free tier for dev.
- **Drizzle ORM** — schema lives in `src/db/schema.ts`, migrations generated from it (this repo has no legacy schema drift to reconcile — it owns the schema from day one).
- **Authorization model** (read this before adding a route): Drizzle connects via `DATABASE_URL`, a direct Postgres connection that runs with a privileged role and **bypasses RLS** — the same way the legacy app's service-role client did. Since almost all data access in this app goes through Drizzle, RLS is not the enforcement mechanism here; every route is responsible for checking who's calling it itself, via `src/lib/auth/requireAdmin.ts` for admin-only routes and explicit `WHERE`-clause scoping (e.g. matching `profiles.id` to the caller) for self-service routes. RLS policies (`supabase/rls-policies.sql`) are still applied as defense-in-depth for the few paths that *do* go through Supabase's anon-key client directly — currently just `auth.getUser()`, growing to include client-side Realtime subscriptions in Phase 7.
- **Cron**: Vercel Cron for scheduled compliance checks (no always-on server needed).
- Vendor integrations (payroll, e-signature, E-Verify, Claude) are added behind their own modules as each phase is built, always sandbox-first — see `.env.example`.

## Running this locally (free tier only, no paid subscriptions required)

```bash
npm install
cp .env.example .env.local   # fill in your own free Supabase project's values
npm run db:push
# In the Supabase SQL editor (or via the Supabase MCP connector's
# apply_migration), run in order:
#   1. supabase/rls-policies.sql (defense-in-depth; see "Architecture"
#      above for what it does and doesn't protect)
#   2. supabase/indexes.sql (covering indexes for FK columns Drizzle
#      doesn't index automatically - flagged by Supabase's own performance
#      advisor)
#   3. supabase/storage-buckets.sql (creates the two private buckets)
npm run dev
```

The project this was built against (`vrwpkgijaeppraokhiis`) has all three
applied and verified via the Supabase connector's advisors: 21 tables, RLS
enabled on every one, zero security or performance warnings (the one
remaining "unused index" note is expected — no query traffic has hit them
yet).

To test the onboarding e-signature flow end to end, Dropbox Sign needs to
reach your app over the internet to deliver the webhook — run
`npx ngrok http 3000` (free) and set `NEXT_PUBLIC_APP_URL` to the ngrok
https URL.

What's free/sandbox for local dev:
- **Supabase**: free project tier (Auth + Postgres + Storage + Realtime all included)
- **Vercel**: hobby/free tier for preview deploys
- **Payroll provider**: sandbox/developer mode (no real money moves)
- **E-signature vendor**: free developer sandbox (DocuSign or Dropbox Sign)
- **Claude API**: pay-as-you-go, no subscription — a free trial credit covers dev-scale usage
- **E-Verify**: no cost. Case tracking works today with no enrollment needed since case creation is manual-entry, not a live API call (see "Full functionality scope" above)

## Running the test suite

```bash
npm install
# A dedicated local Postgres database, separate from your dev Supabase DB.
# Its name MUST contain "test" - src/test/setup.ts refuses to run otherwise
# (the suite TRUNCATEs every app table between tests).
createdb vachi_test
DATABASE_URL="postgresql://<user>:<pass>@localhost:5432/vachi_test" npm run db:push
DATABASE_URL="postgresql://<user>:<pass>@localhost:5432/vachi_test" npm test
```

50 tests across 9 files cover every phase's admin and employee scenarios
against a real Postgres database via the real Drizzle queries - not
against a live Supabase project (Supabase Auth, Storage, and Dropbox Sign
are mocked in `src/test/setup.ts`, since those need real network access
this suite doesn't assume). What's verified: authorization boundaries
(admin-only routes, "your own records only" scoping) on every module,
business logic (3-business-day I-9 due dates, timesheet hour totals
computed server-side not trusted from the client, STEM OPT evaluation due
dates, visa-expiry urgency bucketing, retention-date math), the onboarding
e-signature webhook's HMAC verification (including that a forged event is
correctly ignored), and PDF generation. Not covered: anything requiring a
real browser, real Supabase Auth session, or real third-party API call -
see the README's closing section for what that leaves open.

## Status

- **Phase 1 (auth + DB foundation)**: done. `/login` signs in via Supabase
  Auth, `/dashboard` is middleware-protected, reads the caller's own
  profile through Drizzle, and signs out a deactivated account.
- **Phase 2 (onboarding)**: done for one document type. Admin creates a
  session (`/admin/onboarding`), generates a PDF, sends it for signature via
  Dropbox Sign sandbox; the employee sees status at `/onboarding`; a webhook
  marks it signed and stores the final signed PDF in Storage. Not yet
  verified against a live Dropbox Sign account from this environment (no
  outbound network access here) — run one real sandbox request before
  trusting the webhook/signature-verification code path in production.
- **Phase 3 (I-9/E-Verify)**: done for Sections 1-2 and manual E-Verify case
  tracking. Admin starts an I-9 from `/admin/i9`, employee completes Section
  1 at `/i9`, admin completes Section 2 and records the E-Verify case number
  from `/admin/i9/[id]`. Section 3 reverification due-date is computed but
  has no reminder/action flow yet; TNC workflow and retention-purge
  automation are also still open.
- **Phase 4 (Training)**: done. Task assignment, completion tracking with
  comments, weekly summaries with admin approve/reject, and performance
  reviews with employee acknowledgment are all live. Real file-upload
  materials and automatic quiz scoring are still open.
- **Phase 5 (Timesheets & Payroll)**: done. Employee submits weekly
  timesheets with daily entries (`/timesheets`), admin approves/rejects
  (`/admin/timesheets`). Payroll is manual-entry (no provider chosen yet):
  admin records pay runs and stubs (`/admin/payroll`), employees view theirs
  (`/payroll`).
- **Phase 6 (Immigration & compliance modules)**: done. Visa expiry
  dashboard, STEM OPT I-983 tracking, H-1B PAF management, and green card
  sponsorship pipeline are all live. Automated expiry alerts (vs. the
  admin having to check the dashboard) are still open.
- **Phase 7 (Messaging, notifications, admin dashboard, audit log)**: done.
  Real-time 1:1 messaging (Supabase Realtime), in-app notifications, an
  admin home dashboard aggregating pending work, and an audit-log UI are
  all live.

## What's still genuinely open across the whole app

All seven build phases are done, but "done" means each area has a real,
working, tested implementation - not that every feature is exhaustive.
Concretely still open, in one place rather than scattered per-phase above:

- **Vendor decisions**: payroll provider (Gusto/Check/ADP), e-signature
  vendor (Dropbox Sign is wired up; DocuSign was the alternative, never
  built), DHS E-Verify employer enrollment (blocks the live API, not the
  manual-entry path that works today).
- **Automation that's currently manual dashboards instead of proactive
  alerts**: visa expiry, I-9 Section 3 reverification, STEM OPT evaluation
  deadlines - all trackable today, none of them push a notification yet.
- **File uploads that don't exist yet**: training materials (a task just
  links out via URL), a document-upload feature for the `documents` table
  (defined in the schema, nothing reads or writes it).
- **Reporting/export**: no CSV/PDF export anywhere, despite several admin
  list views that would benefit from one.
- **AI features**: none built. Document intelligence, the compliance
  assistant, and risk-surfacing scans are all still just the plan in
  docs/PLAN.md.
- **Testing**: 50 tests now cover every module's admin/employee
  authorization boundaries and core business logic against a real local
  Postgres database (see "Running the test suite") - a real gap closed,
  not just a plan. Still missing: browser/E2E tests (no real Supabase Auth
  session was available to test against - see below), and load/concurrency
  testing.
- **Schema/RLS/Storage are live on the real project, but nothing has been
  clicked through in a browser yet.** Once the Supabase connector was
  attached, the actual `vrwpkgijaeppraokhiis` project got the full schema
  (21 tables), the RLS policies, covering indexes, and both Storage
  buckets applied directly - not simulated. Supabase's own advisors
  confirm zero security findings and zero performance warnings after a
  follow-up pass (found and fixed: 26 missing FK indexes, 42 RLS policies
  re-evaluating `auth.uid()` per-row instead of once per statement, one
  redundant policy). What's still missing is a real browser session: this
  sandbox has no network path to `*.supabase.co` for plain HTTP (confirmed
  hard-blocked, not a retry issue), so no one has actually signed up,
  logged in, or clicked a button yet. Run `npm run dev` against this
  project and walk through both an admin and an employee account before
  trusting it with real data - the first admin has to be created by hand
  (sign up normally, then in the SQL editor: `update profiles set role =
  'admin' where email = 'you@company.com'`).
