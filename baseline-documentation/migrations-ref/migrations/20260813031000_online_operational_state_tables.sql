-- Supabase-only operational state for print history, schedulers, and escalation.

create table if not exists public.print_jobs (
  id text primary key,
  firm_id uuid not null default public.my_firm_id() references public.organizations(id) on delete cascade,
  doc_type text not null,
  title text not null,
  status text not null check (status in ('printed','pdf_fallback','failed')),
  attempts integer not null default 1,
  last_error text,
  pdf_file_name text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.scheduled_jobs (
  firm_id uuid not null default public.my_firm_id() references public.organizations(id) on delete cascade,
  job_key text not null,
  cadence text not null check (cadence in ('daily','weekly','monthly')),
  last_run_at timestamptz,
  last_status text,
  last_error text,
  updated_at timestamptz not null default now(),
  primary key (firm_id, job_key)
);

create table if not exists public.escalation_state (
  firm_id uuid not null default public.my_firm_id() references public.organizations(id) on delete cascade,
  entity_type text not null,
  entity_id text not null,
  first_flagged_at timestamptz not null,
  last_tier_index integer not null default -1,
  last_sent_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (firm_id, entity_type, entity_id)
);

create index if not exists idx_print_jobs_firm_created
  on public.print_jobs(firm_id, created_at desc);
create index if not exists idx_scheduled_jobs_firm_status
  on public.scheduled_jobs(firm_id, last_status, updated_at desc);
create index if not exists idx_escalation_state_firm_entity
  on public.escalation_state(firm_id, entity_type, entity_id);

alter table public.print_jobs enable row level security;
alter table public.scheduled_jobs enable row level security;
alter table public.escalation_state enable row level security;

grant select, insert, update, delete on
  public.print_jobs,
  public.scheduled_jobs,
  public.escalation_state
to authenticated;

drop policy if exists print_jobs_firm_read on public.print_jobs;
drop policy if exists print_jobs_firm_write on public.print_jobs;
create policy print_jobs_firm_read on public.print_jobs
  for select to authenticated
  using (firm_id = public.my_firm_id() or public.is_saas_admin());
create policy print_jobs_firm_write on public.print_jobs
  for all to authenticated
  using (firm_id = public.my_firm_id() or public.is_saas_admin())
  with check (firm_id = public.my_firm_id() or public.is_saas_admin());

drop policy if exists scheduled_jobs_firm_read on public.scheduled_jobs;
drop policy if exists scheduled_jobs_firm_write on public.scheduled_jobs;
create policy scheduled_jobs_firm_read on public.scheduled_jobs
  for select to authenticated
  using (firm_id = public.my_firm_id() or public.is_saas_admin());
create policy scheduled_jobs_firm_write on public.scheduled_jobs
  for all to authenticated
  using (firm_id = public.my_firm_id() or public.is_saas_admin())
  with check (firm_id = public.my_firm_id() or public.is_saas_admin());

drop policy if exists escalation_state_firm_read on public.escalation_state;
drop policy if exists escalation_state_firm_write on public.escalation_state;
create policy escalation_state_firm_read on public.escalation_state
  for select to authenticated
  using (firm_id = public.my_firm_id() or public.is_saas_admin());
create policy escalation_state_firm_write on public.escalation_state
  for all to authenticated
  using (firm_id = public.my_firm_id() or public.is_saas_admin())
  with check (firm_id = public.my_firm_id() or public.is_saas_admin());
