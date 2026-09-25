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
- 🚧 Visa/document expiry tracking (OPT, STEM OPT, H1B, L1, O1, TN, E3) with 90/60/30-day alerts
- 🚧 STEM OPT I-983 Training Plan tracking (12-month evaluations, self-assessments)
- 🚧 H-1B Public Access File (PAF) management (LCA postings, wage data)
- 🚧 Green card sponsorship pipeline (PERM → I-140 → I-485 / priority date tracking)

**Training**
- 🚧 One consolidated training system (task assignment, completion tracking, weekly summaries, performance reviews, materials/comments) — no legacy/v2 split this time, one design from the start

**Timesheets & payroll**
- 🚧 Timesheet submission/approval
- 🚧 Real payroll processing via a payroll provider (Gusto/Check/ADP — sandbox mode for dev, vendor TBD)

**Communication**
- 🚧 Messaging between admin and employees
- 🚧 Notification boards / in-app + email notifications (Supabase Realtime)

**Admin**
- ✅ Middleware-protected admin/employee routing foundation
- 🚧 Employee management, compliance dashboard, document oversight
- 🚧 Reporting (compliance, analytics) with CSV/PDF export
- 🚧 Audit-log admin UI (every write logged, visible to admins, not just captured in a table)

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
# In the Supabase SQL editor, run supabase/rls-policies.sql (defense-in-depth;
# see "Architecture" above for what it does and doesn't protect)
# In the Supabase dashboard: Storage -> New bucket -> create two PRIVATE
# buckets (do not check "Public bucket"): "onboarding-documents" and "i9-records"
npm run dev
```

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
- **Remaining**, in order: training → payroll + timesheets →
  immigration/compliance modules → messaging + admin reporting. This
  section is updated as each phase ships.
