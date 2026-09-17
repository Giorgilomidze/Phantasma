# Supabase — how the database is set up

Project: **Phantasma** (`https://muumpjtpjnoxxdkhqtik.supabase.co`, eu-central-1).

The schema is **not** in this repo. Source of truth:

    D:\Web Development\Solve Assistant\supabase\schema.sql

That file owns every table (profiles, plans, subscriptions, payments,
candidates, vacancies, shortlists, sends, …), the `get_my_stats()` function
and the RLS policies. Do not edit tables from this repo — change them there.

Run order in Supabase → SQL Editor, once each, in this order:

1. `0001-drop-site-v1.sql` — only if the project still has the first-draft
   `orders` / `services` tables from this repo (Sep 2026). Safe to re-run.
2. `..\Solve Assistant\supabase\schema.sql` — the real schema.
3. `0002-site-additions.sql` — what the website needs on top: the Advanced
   plan, a policy letting a client open their own pending subscription, the
   private `cvs` storage bucket and its policies. Safe to re-run.

What the site (publishable key, RLS-limited) touches:

| Table / RPC     | read | write                                |
|-----------------|------|--------------------------------------|
| profiles        | own  | full_name, phone, language           |
| candidates      | own  | target_titles, min_salary, locations, work_language, cv_url |
| shortlists (+vacancies) | own | client_decision only            |
| sends (+vacancies) | own | —                                  |
| plans           | all  | —                                    |
| subscriptions   | own  | insert own `pending` row (Pay now)   |
| payments        | own  | —                                    |
| get_my_stats()  | own  | —                                    |
| storage `cvs`   | own folder `{user_id}/…` | same           |

## Scripts (from 16 Sep 2026)

Credentials live in `../.env` (git-ignored): `SUPABASE_ACCESS_TOKEN` (personal
access token, Management API) and `SUPABASE_SERVICE_ROLE_KEY` (fetched and
cached automatically by `sb.py`).

| Script | Does |
|---|---|
| `sb.py` | helper: `.env`, `sql()` via Management API, `service_key()` |
| `migrate.py` | applies `NNNN-*.sql` in order, records them in `_migrations`. **This is how schema changes go in now** — add a new numbered file, run `python supabase/migrate.py`. |
| `sync_local.py` | full one-way mirror of `vacancies.db` + the Excel workbooks → cloud. Idempotent. Run after every pipeline run: `python supabase/sync_local.py` (`--dry-run`, `--only table,table`). |

## Schema drift vs `Solve Assistant\supabase\schema.sql`

Applied by `0003-mirror-local.sql`, not yet merged back into the Solve
Assistant copy:

- `vacancies.status` check now includes `gone`; `candidates.status` includes `lead`.
- `candidates` + `email`, `workbook_notes jsonb` (Notes tab of the shortlist workbook).
- `shortlists` + `why_matches`, `salary_text`, `updated_at` (+ touch trigger).
- New table `prospects` (LinkedIn register, RLS on, no policies = owner-only).
- `runs` unique index `(source, started)`; `profiles` backfilled from `auth.users`.
- `_migrations` bookkeeping table.
- `0004`: `deletion_requests` table + `request_account_deletion()` RPC (emails the owner via pg_net → Resend; key in Vault as `resend_api_key`), then deletes the auth user.
- `0005`–`0008`: `profiles` + `linkedin_url`, `cv_path`, `cv_uploaded_at`, `first_name`, `middle_name`, `last_name`; `preferences` table (0006); `cvs` bucket now PDF only, 5 MB.
- `plans.period` check now `once | month | 4weeks`; all three plans are `4weeks` (one payment = four weeks of service).
