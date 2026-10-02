-- Links Supabase Auth accounts to the portal.
--
-- Run after rls-policies.sql. Safe to run more than once.
--
-- 1. When an auth user is created (an HR invite, or a login made in the Supabase dashboard) and
--    an employee record has the same email, give them an `employee` profile and link the
--    employee record to it. Accounts with no matching employee (for example a website-only
--    admin) are left alone, so they never get portal access by accident.
-- 2. One employee record per email, compared case-insensitively, so that link is unambiguous.
-- 3. Adds `messages` to the Realtime publication; without it the chat only updates on reload.

create or replace function public.portal_link_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized text := lower(new.email);
begin
  if normalized is null then
    return new;
  end if;

  if exists (select 1 from public.employees e where lower(e.email) = normalized) then
    insert into public.profiles (id, email, role, is_active)
    values (new.id, normalized, 'employee', true)
    on conflict (id) do nothing;

    update public.employees
       set user_id = new.id, updated_at = now()
     where lower(email) = normalized
       and user_id is null;
  end if;

  return new;
exception
  when others then
    -- Never block sign-up or an invite because of the portal; HR can link the account later.
    raise warning 'portal_link_auth_user failed for %: %', new.id, sqlerrm;
    return new;
end;
$$;

revoke all on function public.portal_link_auth_user() from public, anon, authenticated;

drop trigger if exists portal_link_auth_user on auth.users;
create trigger portal_link_auth_user
  after insert on auth.users
  for each row execute function public.portal_link_auth_user();

create unique index if not exists employees_email_lower_key on public.employees (lower(email));

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
     ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end;
$$;
