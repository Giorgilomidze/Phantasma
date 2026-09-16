-- 0006 — client preferences questionnaire (preferences.html).
-- One row per login. Salary is typed (numbers + currency, net per month);
-- every other answer lives in `answers` jsonb keyed by question id (q1..q24)
-- so questions can be added or reworded without a migration.
-- Clients read/write their own row; the pipeline reads with the service key.

create table if not exists preferences (
  user_id      uuid primary key references profiles (id) on delete cascade,
  salary_min   integer check (salary_min is null or salary_min >= 0),
  salary_max   integer check (salary_max is null or salary_max >= 0),
  currency     text not null default 'GEL' check (currency in ('GEL', 'EUR', 'USD')),
  answers      jsonb not null default '{}'::jsonb,
  updated_at   timestamptz not null default now()
);

alter table preferences enable row level security;

drop policy if exists "own preferences" on preferences;
create policy "own preferences" on preferences
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop trigger if exists preferences_touch on preferences;
create trigger preferences_touch before update on preferences
  for each row execute function touch_updated_at();
