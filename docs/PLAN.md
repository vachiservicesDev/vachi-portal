# Build plan

## Context

Vachi Portal is a greenfield rebuild of the feature set from
`vs-self-services-portal`, in its own repository, built as a one-stop
internal platform for both admins (HR/ops) and employees. It targets full
functional parity with the legacy app plus the compliance features that app
was missing (I-9/E-Verify, real payroll processing, working e-signature,
STEM OPT/PAF/green-card tracking) — see README.md for the complete
functionality checklist and what's built vs. pending.

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
3. **I-9 / E-Verify module** — digital I-9 Sections 1–3, E-Verify sandbox
   integration, TNC workflow, retention-rule engine, audit export.
4. **Training** — one consolidated system: task assignment, completion
   tracking, weekly summaries, performance reviews, materials/comments.
   (No legacy/v2 split to reconcile this time — designed as one system from
   the start.)
5. **Payroll provider (sandbox) + timesheets.**
6. **Immigration & compliance modules** — visa/document expiry tracking,
   STEM OPT I-983 tracking, H-1B PAF management, green card pipeline.
7. **Messaging/notifications (Supabase Realtime) + admin dashboards,
   reporting, audit-log UI.**
8. **AI features** (can start once there's real data to work with, likely
   alongside phases 2–3 for document intelligence specifically): Claude API
   for document field extraction, compliance assistant, risk surfacing.

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
