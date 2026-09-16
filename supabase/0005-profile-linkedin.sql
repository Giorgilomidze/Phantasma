-- 0005 — profiles.linkedin_url, filled in by the client on account.html.
-- sync_local.py matches candidates.profile_url (LinkedIn slug) against it,
-- so a researched person gets linked to their login even when the email in
-- the local DB is missing or different.
alter table profiles add column if not exists linkedin_url text;
