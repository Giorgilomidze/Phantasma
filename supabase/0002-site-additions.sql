-- Website additions on top of Solve Assistant\supabase\schema.sql.
-- Run after it. Safe to re-run. Adds nothing the pipeline depends on.


-- 1. Plans: the site sells three tiers (projects.html). schema.sql seeds two.
insert into plans (code, name, price_gel, period, sort) values
  ('advanced', 'Advanced', 80, '4weeks', 3)
on conflict (code) do nothing;


-- 2. Pay now: the client opens a subscription request for themself. Only a
--    'pending' row, only for an active plan. Status changes stay owner-side.
drop policy if exists "open own pending subscription" on subscriptions;
create policy "open own pending subscription" on subscriptions
  for insert to authenticated
  with check (
    account_id = auth.uid()
    and status = 'pending'
    and plan_code in (select code from plans where is_active)
  );


-- 3. CV uploads: private bucket, each user confined to their own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cvs', 'cvs', false, 10485760,
        array['application/pdf',
              'application/msword',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "cvs: read own folder"   on storage.objects;
drop policy if exists "cvs: write own folder"  on storage.objects;
drop policy if exists "cvs: update own folder" on storage.objects;
drop policy if exists "cvs: delete own folder" on storage.objects;

create policy "cvs: read own folder" on storage.objects
  for select to authenticated
  using (bucket_id = 'cvs' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "cvs: write own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'cvs' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "cvs: update own folder" on storage.objects
  for update to authenticated
  using (bucket_id = 'cvs' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "cvs: delete own folder" on storage.objects
  for delete to authenticated
  using (bucket_id = 'cvs' and (storage.foldername(name))[1] = auth.uid()::text);
