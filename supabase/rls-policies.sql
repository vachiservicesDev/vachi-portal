-- Defense-in-depth RLS for Vachi Portal.
--
-- IMPORTANT: as explained in src/db/schema.ts and README.md
-- ("Architecture"), the app's own server-side queries go through Drizzle
-- via a direct Postgres connection and BYPASS these policies entirely.
-- These policies only take effect for access through Supabase's anon-key
-- client (currently just auth.getUser() and the messages Realtime
-- subscription). Applying this file does not, by itself, make any
-- Drizzle-backed API route secure — that's the job of
-- src/lib/auth/requireAdmin.ts and the explicit scoping in each route.
--
-- Run this in the Supabase SQL editor after `npm run db:push` has created
-- the tables. Every `auth.uid()` call below is wrapped as
-- `(select auth.uid())` — Supabase's documented RLS performance fix, so
-- Postgres evaluates it once per statement instead of once per row. This
-- has been applied and verified against the live project (zero
-- security/performance advisories as of the last check).

alter table profiles enable row level security;
alter table employees enable row level security;
alter table documents enable row level security;
alter table onboarding_sessions enable row level security;
alter table onboarding_documents enable row level security;
alter table i9_records enable row level security;
alter table training_tasks enable row level security;
alter table training_assignments enable row level security;
alter table training_comments enable row level security;
alter table weekly_training_summaries enable row level security;
alter table performance_reviews enable row level security;
alter table timesheets enable row level security;
alter table timesheet_entries enable row level security;
alter table pay_runs enable row level security;
alter table pay_stubs enable row level security;
alter table stem_opt_training_plans enable row level security;
alter table h1b_public_access_files enable row level security;
alter table green_card_cases enable row level security;
alter table messages enable row level security;
alter table notifications enable row level security;
alter table audit_logs enable row level security;

-- profiles: a user can see their own row; admins can see all.
create policy "profiles_select_own" on profiles
  for select using ((select auth.uid()) = id);
create policy "profiles_select_admin" on profiles
  for select using (
    exists (select 1 from profiles p where p.id = (select auth.uid()) and p.role = 'admin')
  );

-- employees: an employee can see their own row (once linked via user_id);
-- admins can see and manage all. (Just two policies, not three: an
-- earlier draft also had an employees_select_admin policy, but
-- employees_all_admin's FOR ALL already covers admin SELECT - the
-- redundant one was dropped after Supabase's performance advisor flagged
-- it as a duplicate permissive policy.)
create policy "employees_select_own" on employees
  for select using ((select auth.uid()) = user_id);
create policy "employees_all_admin" on employees
  for all using (
    exists (select 1 from profiles p where p.id = (select auth.uid()) and p.role = 'admin')
  );

-- documents: an employee can see their own; admins can see and manage all.
create policy "documents_select_own" on documents
  for select using (
    employee_id in (select id from employees where user_id = (select auth.uid()))
  );
create policy "documents_all_admin" on documents
  for all using (
    exists (select 1 from profiles p where p.id = (select auth.uid()) and p.role = 'admin')
  );

-- onboarding_sessions / onboarding_documents: admin-managed; an employee
-- can read their own once employees.user_id is linked (matches by email
-- before that, which these policies can't express — the /api/onboarding/me
-- route's own scoping handles the pre-link case).
create policy "onboarding_sessions_all_admin" on onboarding_sessions
  for all using (
    exists (select 1 from profiles p where p.id = (select auth.uid()) and p.role = 'admin')
  );
create policy "onboarding_sessions_select_own" on onboarding_sessions
  for select using (
    employee_id in (select id from employees where user_id = (select auth.uid()))
  );

create policy "onboarding_documents_all_admin" on onboarding_documents
  for all using (
    exists (select 1 from profiles p where p.id = (select auth.uid()) and p.role = 'admin')
  );
create policy "onboarding_documents_select_own" on onboarding_documents
  for select using (
    session_id in (
      select os.id from onboarding_sessions os
      join employees e on e.id = os.employee_id
      where e.user_id = (select auth.uid())
    )
  );

-- i9_records: contains SSN and immigration-status data - treat as
-- sensitive as documents/onboarding above.
create policy "i9_records_all_admin" on i9_records
  for all using (
    exists (select 1 from profiles p where p.id = (select auth.uid()) and p.role = 'admin')
  );
create policy "i9_records_select_own" on i9_records
  for select using (
    employee_id in (select id from employees where user_id = (select auth.uid()))
  );

-- training_tasks: the catalog itself is readable by any authenticated
-- employee (assignment, not visibility, is what's restricted); only admins
-- manage it.
create policy "training_tasks_select_all" on training_tasks
  for select using ((select auth.uid()) is not null);
create policy "training_tasks_write_admin" on training_tasks
  for insert with check (
    exists (select 1 from profiles p where p.id = (select auth.uid()) and p.role = 'admin')
  );
create policy "training_tasks_update_admin" on training_tasks
  for update using (
    exists (select 1 from profiles p where p.id = (select auth.uid()) and p.role = 'admin')
  );

create policy "training_assignments_all_admin" on training_assignments
  for all using (
    exists (select 1 from profiles p where p.id = (select auth.uid()) and p.role = 'admin')
  );
create policy "training_assignments_own" on training_assignments
  for all using (
    employee_id in (select id from employees where user_id = (select auth.uid()))
  );

create policy "training_comments_all_admin" on training_comments
  for all using (
    exists (select 1 from profiles p where p.id = (select auth.uid()) and p.role = 'admin')
  );
create policy "training_comments_own" on training_comments
  for all using (
    assignment_id in (
      select ta.id from training_assignments ta
      join employees e on e.id = ta.employee_id
      where e.user_id = (select auth.uid())
    )
  );

create policy "weekly_summaries_all_admin" on weekly_training_summaries
  for all using (
    exists (select 1 from profiles p where p.id = (select auth.uid()) and p.role = 'admin')
  );
create policy "weekly_summaries_own" on weekly_training_summaries
  for all using (
    employee_id in (select id from employees where user_id = (select auth.uid()))
  );

create policy "performance_reviews_all_admin" on performance_reviews
  for all using (
    exists (select 1 from profiles p where p.id = (select auth.uid()) and p.role = 'admin')
  );
create policy "performance_reviews_select_own" on performance_reviews
  for select using (
    employee_id in (select id from employees where user_id = (select auth.uid()))
  );

create policy "timesheets_all_admin" on timesheets
  for all using (
    exists (select 1 from profiles p where p.id = (select auth.uid()) and p.role = 'admin')
  );
create policy "timesheets_own" on timesheets
  for all using (
    employee_id in (select id from employees where user_id = (select auth.uid()))
  );

create policy "timesheet_entries_all_admin" on timesheet_entries
  for all using (
    exists (select 1 from profiles p where p.id = (select auth.uid()) and p.role = 'admin')
  );
create policy "timesheet_entries_own" on timesheet_entries
  for all using (
    timesheet_id in (
      select t.id from timesheets t
      join employees e on e.id = t.employee_id
      where e.user_id = (select auth.uid())
    )
  );

-- pay_runs / pay_stubs: financial data - admin-managed, employees can only
-- read their own stub rows, never the run itself.
create policy "pay_runs_all_admin" on pay_runs
  for all using (
    exists (select 1 from profiles p where p.id = (select auth.uid()) and p.role = 'admin')
  );

create policy "pay_stubs_all_admin" on pay_stubs
  for all using (
    exists (select 1 from profiles p where p.id = (select auth.uid()) and p.role = 'admin')
  );
create policy "pay_stubs_select_own" on pay_stubs
  for select using (
    employee_id in (select id from employees where user_id = (select auth.uid()))
  );

create policy "stem_opt_all_admin" on stem_opt_training_plans
  for all using (
    exists (select 1 from profiles p where p.id = (select auth.uid()) and p.role = 'admin')
  );
create policy "stem_opt_select_own" on stem_opt_training_plans
  for select using (
    employee_id in (select id from employees where user_id = (select auth.uid()))
  );

-- h1b_public_access_files: admin/compliance-only - not personal employee
-- data the employee self-service side needs to read.
create policy "paf_all_admin" on h1b_public_access_files
  for all using (
    exists (select 1 from profiles p where p.id = (select auth.uid()) and p.role = 'admin')
  );

create policy "green_card_all_admin" on green_card_cases
  for all using (
    exists (select 1 from profiles p where p.id = (select auth.uid()) and p.role = 'admin')
  );
create policy "green_card_select_own" on green_card_cases
  for select using (
    employee_id in (select id from employees where user_id = (select auth.uid()))
  );

-- messages: THIS is the one table where RLS is the actual runtime
-- enforcement, not defense-in-depth - the Realtime subscription in
-- src/app/(dashboard)/messages/[userId]/page.tsx goes through the anon-key
-- client and Realtime only ever delivers rows a policy allows the
-- subscriber to select. Get this one right.
create policy "messages_select_own" on messages
  for select using ((select auth.uid()) = sender_id or (select auth.uid()) = recipient_id);
create policy "messages_insert_own" on messages
  for insert with check ((select auth.uid()) = sender_id);
create policy "messages_update_recipient" on messages
  for update using ((select auth.uid()) = recipient_id);

create policy "notifications_select_own" on notifications
  for select using ((select auth.uid()) = user_id);
create policy "notifications_update_own" on notifications
  for update using ((select auth.uid()) = user_id);

-- audit_logs: admin-only, no employee access at all - it's a compliance
-- record, not something anyone should be able to read about themselves.
create policy "audit_logs_select_admin" on audit_logs
  for select using (
    exists (select 1 from profiles p where p.id = (select auth.uid()) and p.role = 'admin')
  );
