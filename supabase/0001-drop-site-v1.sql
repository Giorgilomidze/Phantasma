-- Removes the first-draft site tables (orders / services / profiles + enums)
-- created from this repo before the Solve Assistant schema became the source
-- of truth. Only needed on the Phantasma project created 14 Sep 2026.
-- Nothing of value was stored in them. Safe to re-run.

drop table if exists public.services cascade;
drop table if exists public.orders   cascade;
drop table if exists public.profiles cascade;   -- recreated (different columns) by schema.sql
drop function if exists public.touch_updated_at() cascade;
drop type if exists public.service_status;
drop type if exists public.order_status;
drop type if exists public.tier;
