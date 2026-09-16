-- 0003 — make Supabase a full mirror of the local data (vacancies.db + the
-- Excel workbooks). Applied with:  python supabase/migrate.py
-- Safe to re-run. Everything here is additive; nothing the site or the
-- pipeline depends on is renamed or dropped.
--
-- Diverges from Solve Assistant\supabase\schema.sql — see README "Schema
-- drift" so that session can merge it back.


-- 1. Status values the local DB actually uses ---------------------------------
alter table vacancies  drop constraint if exists vacancies_status_check;
alter table vacancies  add  constraint vacancies_status_check
  check (status in ('live','expired','gone','unknown'));

alter table candidates drop constraint if exists candidates_status_check;
alter table candidates add  constraint candidates_status_check
  check (status in ('lead','prospect','client','paused','churned'));


-- 2. Columns that exist locally / in Excel but not in the cloud ----------------
alter table candidates add column if not exists email          text;          -- local column; also used to link account_id
alter table candidates add column if not exists workbook_notes jsonb;         -- the "Notes" tab of NNN II Job Shortlist.xlsx, {label: text}
alter table shortlists add column if not exists why_matches    text;          -- Excel "Why it matches"
alter table shortlists add column if not exists salary_text    text;          -- Excel "Salary (if stated)" as shown that week
alter table shortlists add column if not exists updated_at     timestamptz not null default now();

create unique index if not exists candidates_email_idx on candidates (lower(email)) where email is not null;


-- 3. LinkedIn prospect register (Linkedin profiles.xlsx, "Prospects" tab) ------
-- Sales pipeline, owner-only: RLS on, no policies => service_role only.
create table if not exists prospects (
  no                integer primary key,                    -- "No." = candidates.sheet_no
  process           text,                                   -- "Yes" once worked
  name              text not null,
  headline          text,
  company           text,
  function          text,
  seniority         text,
  credentials       text,
  headline_score    integer,                                -- /20
  headline_band     text,                                   -- Weak | Basic | Good | Strong
  profile_weakness  text,
  pitch_angle       text,
  priority          text,                                   -- Low | Medium | High
  profile_url       text,
  source            text,
  date_added        text,                                   -- as typed in the sheet, e.g. "8 Sep 2026"
  email             text,
  synced_at         timestamptz not null default now()
);
alter table prospects enable row level security;


-- 4. Run log: local `started`/`finished` are ISO text; keep the cloud typed ----
-- (runs already exists with timestamptz; nothing to change.)
create unique index if not exists runs_local_idx on runs (source, started);


-- 5. profiles backfill: users who signed in before the trigger existed ---------
insert into profiles (id, email, full_name)
select id, email, coalesce(raw_user_meta_data->>'full_name', '')
from auth.users
on conflict (id) do nothing;


-- 6. Keep updated_at fresh on shortlists ----------------------------------------
create or replace function touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
drop trigger if exists shortlists_touch on shortlists;
create trigger shortlists_touch before update on shortlists
  for each row execute function touch_updated_at();
