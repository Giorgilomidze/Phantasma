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
