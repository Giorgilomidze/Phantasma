-- 0009 — the client's shortlist workbook, downloadable from account.html.
-- sync_local.py uploads "NNN II Job Shortlist.xlsx" to bucket `shortlists`
-- at <candidate slug>/<file> on every run and records the path here.
alter table candidates add column if not exists workbook_path        text;
alter table candidates add column if not exists workbook_uploaded_at timestamptz;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('shortlists', 'shortlists', false, 20971520,
        array['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- A client may read the folder of the candidate row linked to their login.
-- Writes come only from the sync (service key).
drop policy if exists "shortlists: read own workbook" on storage.objects;
create policy "shortlists: read own workbook" on storage.objects
  for select to authenticated
  using (bucket_id = 'shortlists'
         and (storage.foldername(name))[1] in (select slug from candidates where account_id = auth.uid()));
