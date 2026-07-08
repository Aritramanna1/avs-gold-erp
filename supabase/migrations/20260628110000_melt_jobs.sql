-- Migration: melt_jobs table for Melt Account Module
create table if not exists public.melt_jobs (
  id uuid primary key default gen_random_uuid(),
  job_no text not null,
  branch_id uuid not null references public.branches(id) on delete cascade,
  date date not null default current_date,
  karigar_id uuid references public.people(id),
  karigar_name text,
  status text not null default 'open' check (status in ('open','processing','completed','cancelled')),
  -- Input weights (all in milligrams)
  scrap_input_gross_mg bigint not null default 0,
  scrap_input_purity integer not null default 0, -- per-mille
  dust_input_gross_mg bigint not null default 0,
  dust_input_purity integer not null default 0,
  other_input_gross_mg bigint not null default 0,
  other_input_purity integer not null default 0,
  total_input_fine_mg bigint not null default 0,
  -- Recovery weights
  fine_gold_recovered_mg bigint not null default 0,
  scrap_returned_mg bigint not null default 0,
  -- Calculations
  recovery_pct integer not null default 0, -- basis points e.g. 9850 = 98.50%
  loss_fine_mg bigint not null default 0,
  -- Refinery info
  refinery_name text,
  refinery_receipt_no text,
  refinery_sent_date date,
  refinery_received_date date,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.melt_jobs enable row level security;

create policy "Branch members can manage melt_jobs"
  on public.melt_jobs for all
  using (branch_id in (
    select branch_id from public.user_profiles where user_id = auth.uid()
  ));

create index on public.melt_jobs(branch_id);
create index on public.melt_jobs(date);
create index on public.melt_jobs(karigar_id);
