-- Creates the two private Storage buckets this app needs. Run once per
-- Supabase project. Verified against the live project - both buckets
-- exist with public=false.

insert into storage.buckets (id, name, public)
values
  ('onboarding-documents', 'onboarding-documents', false),
  ('i9-records', 'i9-records', false)
on conflict (id) do nothing;
