-- 0010 — live KPI funnel for the Projects page, straight from the cloud tables.
-- Replaces data/kpis.json (kept only as a fallback if the query fails).
--
-- A view owned by postgres runs with the owner's rights (security_invoker is
-- off by default), so it can read tables that are RLS-locked for anon. It
-- exposes nothing but seven counts and a date — no rows leak.
-- Safe to re-run.

create or replace view public_kpis as
select
  (select count(*) from vacancies where status = 'live')                        as vacancies_tracked,
  (select count(*) from companies)                                              as companies_searched,
  (select count(*) from prospects)                                              as profiles_researched,
  (select count(*) from candidates where status in ('lead','client'))           as job_markets_investigated,
  (select count(*) from shortlists)                                             as vacancies_matched,
  (select count(*) from shortlists where client_decision = 'interested')        as approved_by_clients,
  (select count(*) from sends)                                                  as leads_sent,
  -- "Updated …" date = the most recent thing the local pipeline pushed
  greatest(
    (select max(last_seen)::timestamptz from vacancies),
    (select max(updated_at)             from shortlists),
    (select max(synced_at)              from prospects),
    (select max(sent_at)                from sends)
  )::date                                                                       as as_of;

alter view public_kpis owner to postgres;
grant select on public_kpis to anon, authenticated;
