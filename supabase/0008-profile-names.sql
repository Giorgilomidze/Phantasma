-- 0008 — profile details entered by the client (profile modal on account.html).
-- full_name stays as the display name; it is rebuilt from the parts on save.
alter table profiles add column if not exists first_name  text;
alter table profiles add column if not exists middle_name text;
alter table profiles add column if not exists last_name   text;
