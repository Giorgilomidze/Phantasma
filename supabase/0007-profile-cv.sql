-- 0007 — CV upload from account.html. The file lives in the private `cvs`
-- bucket at <user_id>/cv-<timestamp>.<ext> (policies from 0002); the path is
-- kept on the login's profile so it works before a candidates row exists.
-- sync_local.py copies it into candidates.cv_url once the two are linked.
alter table profiles add column if not exists cv_path        text;
alter table profiles add column if not exists cv_uploaded_at timestamptz;
