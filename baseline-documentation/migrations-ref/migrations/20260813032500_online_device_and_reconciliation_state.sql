-- Supabase-only device registry and gold reconciliation history.

create table if not exists public.device_registry (
  firm_id uuid not null default public.my_firm_id() references public.organizations(id) on delete cascade,
  device_id text not null,
  label text not null,
  platform text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  trusted boolean not null default true,
  primary key (firm_id, device_id)
);

create table if not exists public.gold_reconciliation_reports (
  id text primary key,
  firm_id uuid not null default public.my_firm_id() references public.organizations(id) on delete cascade,
  generated_at timestamptz not null default now(),
  branch_id text,
  total_checked integer not null default 0,
  exception_count integer not null default 0,
  report_json jsonb not null
);

create index if not exists idx_device_registry_firm_last_seen
  on public.device_registry(firm_id, last_seen_at desc);
create index if not exists idx_gold_reconciliation_reports_firm_generated
  on public.gold_reconciliation_reports(firm_id, generated_at desc);

alter table public.device_registry enable row level security;
alter table public.gold_reconciliation_reports enable row level security;

grant select, insert, update, delete on
  public.device_registry,
  public.gold_reconciliation_reports
to authenticated;

drop policy if exists device_registry_firm_read on public.device_registry;
drop policy if exists device_registry_firm_write on public.device_registry;
create policy device_registry_firm_read on public.device_registry
  for select to authenticated
  using (firm_id = public.my_firm_id() or public.is_saas_admin());
create policy device_registry_firm_write on public.device_registry
  for all to authenticated
  using (firm_id = public.my_firm_id() or public.is_saas_admin())
  with check (firm_id = public.my_firm_id() or public.is_saas_admin());

drop policy if exists gold_reconciliation_reports_firm_read on public.gold_reconciliation_reports;
drop policy if exists gold_reconciliation_reports_firm_write on public.gold_reconciliation_reports;
create policy gold_reconciliation_reports_firm_read on public.gold_reconciliation_reports
  for select to authenticated
  using (firm_id = public.my_firm_id() or public.is_saas_admin());
create policy gold_reconciliation_reports_firm_write on public.gold_reconciliation_reports
  for all to authenticated
  using (firm_id = public.my_firm_id() or public.is_saas_admin())
  with check (firm_id = public.my_firm_id() or public.is_saas_admin());
