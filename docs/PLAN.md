# Build plan

## Context

Vachi Portal is a greenfield rebuild of the feature set from
`vs-self-services-portal`, in its own repository, built as a one-stop
internal platform for both admins (HR/ops) and employees. It targets full
functional parity with the legacy app plus the compliance features that app
was missing (I-9/E-Verify, real payroll processing, working e-signature,
STEM OPT/PAF/green-card tracking) — see README.md for the complete
functionality checklist and what's built vs. pending.

**Infrastructure status**: the real Supabase project (`vrwpkgijaeppraokhiis`)
is live and fully migrated — schema, RLS policies, covering indexes, and
both Storage buckets are applied and verified (zero advisory findings). An
automated test suite (50 tests) covers every phase's business logic
against a real Postgres database. See README.md, "Running the test suite"
and the closing section, for exactly what's verified vs. still open (a
real browser/Auth session hasn't been exercised yet).

Unlike the legacy app, there is no strangler-fig migration here: no live
system to keep running against, no old code to cut over from. Features are
still built one at a time, in the order below, each one fully working and
tested before the next starts — that discipline is kept not because of a
migration, but because it's how a large scope stays gap-free instead of
half-built everywhere at once.

## Confirmed decisions

- **I-9/E-Verify**: full digital I-9 (Sections 1–3) + live DHS E-Verify Web
  Services API integration. Live API use requires DHS employer (and
  employer-agent, if applicable) enrollment — a business/legal step in
  parallel with development, not a blocker for building/testing the module.
- **Payroll**: integrate a real payroll provider (not just paystub storage).
  Vendor still open — Gusto (fastest to integrate, embedded UI), Check
  (API-first/white-label), or ADP (enterprise) — decide before Phase 5.
- **E-signature**: DocuSign or Dropbox Sign (vendor still open) — sandbox
  mode for all development.
- **Hosting**: single Next.js app on Vercel (free/hobby tier for dev).
- **Testing**: sandbox/free-tier everything until go-live — see README,
  "Running this locally."

## Build order

1. **Foundation** — ✅ done. Next.js 14 + Supabase Auth + Drizzle schema +
   one working login → protected-dashboard vertical slice. (Correction from
   the original plan: authorization is enforced in application code, not
   RLS, since Drizzle bypasses RLS — see README.md "Architecture".)
2. **Onboarding** — ✅ done for one document type (generic acknowledgment
   PDF). Admin creates session → generates PDF → sends via Dropbox Sign
   sandbox → webhook marks signed + stores final PDF in Storage. Real forms
   (I-9, offer letters, etc.) and the DocuSign-vs-Dropbox-Sign vendor
   decision are still open.
3. **I-9 / E-Verify module** — ✅ done for Sections 1-2 + manual E-Verify
   case tracking. E-Verify is deliberately manual-entry, not a live DHS API
   call (writing a best-effort client against unverified federal API docs
   was judged worse than not having one — see
   `src/lib/everify/manualProvider.ts`). Still open: Section 3
   reverification reminder/action flow, TNC workflow, retention-purge
   automation (the date is computed but nothing acts on it), ICE/DOL audit
   export bundle.
4. **Training** — ✅ done. One consolidated system: task assignment,
   completion tracking with comments, weekly summaries (submit/approve/
   reject), performance reviews (create/submit/acknowledge). No legacy/v2
   split to reconcile this time. Still open: real file-upload materials
   (tasks currently just link out via `contentUrl`) and automatic quiz
   scoring.
5. **Payroll + timesheets** — ✅ done. Timesheet submission/approval is
   fully live. Payroll is manual-entry (`src/db/schema.ts`'s `payRuns`/
   `payStubs`, provider field defaults to `'manual'`) since the vendor
   decision is still open — same provider-agnostic pattern as
   `src/lib/everify`, ready for a real Gusto/Check/ADP adapter once chosen.
6. **Immigration & compliance modules** — ✅ done. Visa expiry dashboard
   (urgency-bucketed, reads `employees.visa_expiry_date`), STEM OPT I-983
   tracking with computed 12-month/final evaluation due dates, H-1B PAF
   management (admin-only, it's a public-disclosure record not personal
   data), green card sponsorship stage tracking. Still open: automated
   alerts (today it's a dashboard someone has to check) and joining
   document-level expiry in once that feature has data.
7. **Messaging/notifications + admin dashboard/audit-log UI** — ✅ done.
   1:1 messaging over Supabase Realtime (the one table where RLS is real
   runtime enforcement, not defense-in-depth - see
   `supabase/rls-policies.sql`), in-app notifications wired into a
   representative set of actions, an admin home dashboard aggregating
   pending work, and an audit-log UI (also representative coverage, not
   every write). Reporting/CSV export is still open.
8. **AI features** — 🚧 not started. Claude API for document field
   extraction, compliance assistant, risk surfacing. See README.md,
   "What's still genuinely open across the whole app" for this plus every
   other open item in one place, now that all seven build phases are done.

## Verification per phase

- Each phase ships with: a working end-to-end flow (not just API routes),
  tests for the parts where a silent bug has real consequences (auth,
  payroll, document generation/signing, E-Verify case handling), and a
  README status-line update.
- Vendor integrations (E-Verify, payroll, e-signature) are verified against
  their sandbox/developer mode before any production credential is used.

## Still open (need your input, not blocking development)

- Payroll provider: Gusto vs Check vs ADP.
- E-signature vendor: DocuSign vs Dropbox Sign.
- E-Verify employer/employer-agent enrollment status and timeline.
- Email provider: Resend only, or is a fallback (Zoho/Gmail SMTP) actually needed?
- SMS provider: Twilio vs AWS SNS, or drop SMS entirely.
