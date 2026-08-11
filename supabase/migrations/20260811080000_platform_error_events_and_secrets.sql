-- Health monitoring: client-side errors (error-handling.ts's reportUnexpectedError)
-- currently only log to the browser console — the platform owner has no way
-- to see what's breaking for tenants. This table is the missing link.
create table if not exists public.platform_error_events (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid,
  actor_id uuid,
  reference_id text not null,
  category text not null,
  severity text not null,
  context text,
  message text not null,
  technical_message text,
  created_at timestamptz not null default now()
);

create index if not exists platform_error_events_created_idx on public.platform_error_events (created_at desc);
create index if not exists platform_error_events_firm_idx on public.platform_error_events (firm_id);

alter table public.platform_error_events enable row level security;

-- Any authenticated tenant user can report an error (write-only from their
-- side — they can't read other firms' errors back).
create policy platform_error_events_insert on public.platform_error_events
for insert to authenticated
with check (true);

create policy platform_error_events_admin on public.platform_error_events
for all to authenticated
using (public.is_saas_admin())
with check (public.is_saas_admin());

grant insert on public.platform_error_events to authenticated;
grant select, update, delete on public.platform_error_events to authenticated;

-- Platform settings: mark a row as secret so its value is never rendered
-- back to the browser after being saved — the admin settings UI becomes
-- write-only for these (paste a new value; can't read the old one), the
-- practical minimum for storing API keys/webhook secrets in this table.
alter table public.platform_settings add column if not exists is_secret boolean not null default false;
