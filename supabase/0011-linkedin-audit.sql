-- 0011 — LinkedIn audit per candidate. Written by sync_local.py from
-- `NNN II LinkedIn Audit.json` in the candidate folder; read by the client
-- on account.html through the existing "own candidate" policy.
-- Shape: {profile_url, audited_at, score, score_max, sections:[{section,current,suggested,why}]}
alter table candidates add column if not exists linkedin_audit jsonb;
