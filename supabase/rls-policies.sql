-- Defense-in-depth RLS for Vachi Portal.
--
-- IMPORTANT: as explained in src/db/schema.ts and README.md
-- ("Architecture"), the app's own server-side queries go through Drizzle
-- via a direct Postgres connection and BYPASS these policies entirely.
-- These policies only take effect for access through Supabase's anon-key
-- client (currently just auth.getUser(); growing to cover client-side
-- Realtime subscriptions in a later phase). Applying this file does not,
-- by itself, make any Drizzle-backed API route secure — that's the job of
-- src/lib/auth/requireAdmin.ts and the explicit scoping in each route.
--
-- Run this in the Supabase SQL editor after `npm run db:push` has created
-- the tables.

alter table profiles enable row level security;
alter table employees enable row level security;
alter table documents enable row level security;
alter table onboarding_sessions enable row level security;
alter table onboarding_documents enable row level security;
alter table i9_records enable row level security;

-- profiles: a user can see their own row; admins can see all.
create policy "profiles_select_own" on profiles
  for select using (auth.uid() = id);
create policy "profiles_select_admin" on profiles
  for select using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- employees: an employee can see their own row (once linked via user_id);
-- admins can see and manage all.
create policy "employees_select_own" on employees
  for select using (auth.uid() = user_id);
create policy "employees_select_admin" on employees
  for select using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );
create policy "employees_all_admin" on employees
  for all using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- documents: an employee can see their own; admins can see and manage all.
create policy "documents_select_own" on documents
  for select using (
    employee_id in (select id from employees where user_id = auth.uid())
  );
create policy "documents_all_admin" on documents
  for all using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- onboarding_sessions / onboarding_documents: admin-managed; an employee
-- can read their own once employees.user_id is linked (matches by email
-- before that, which these policies can't express — the /api/onboarding/me
-- route's own scoping handles the pre-link case).
create policy "onboarding_sessions_all_admin" on onboarding_sessions
  for all using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );
create policy "onboarding_sessions_select_own" on onboarding_sessions
  for select using (
    employee_id in (select id from employees where user_id = auth.uid())
  );

create policy "onboarding_documents_all_admin" on onboarding_documents
  for all using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );
create policy "onboarding_documents_select_own" on onboarding_documents
  for select using (
    session_id in (
      select os.id from onboarding_sessions os
      join employees e on e.id = os.employee_id
      where e.user_id = auth.uid()
    )
  );

-- i9_records: contains SSN and immigration-status data - treat as
-- sensitive as documents/onboarding above.
create policy "i9_records_all_admin" on i9_records
  for all using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );
create policy "i9_records_select_own" on i9_records
  for select using (
    employee_id in (select id from employees where user_id = auth.uid())
  );
