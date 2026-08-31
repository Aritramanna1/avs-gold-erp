-- Reconciled from production (project dqgrrafuoxaorvyrcuuh) on 2026-08-11 — this migration was applied directly to Supabase and had no local file until now.

create table if not exists public.supplier_purchases (
  id uuid primary key,
  firm_id uuid not null references public.organizations(id) on delete cascade,
  branch_id text,
  purchase_no text not null,
  supplier_id uuid not null,
  invoice_no text,
  invoice_date date,
  metal text not null default 'Gold',
  purity_permille integer,
  gross_mg bigint not null default 0,
  fine_mg bigint not null default 0,
  subtotal_paise bigint not null default 0,
  gst_rate_pct numeric(8,3) not null default 0,
  gst_paise bigint not null default 0,
  total_paise bigint not null default 0,
  paid_paise bigint not null default 0,
  due_paise bigint not null default 0,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists supplier_purchases_firm_date_idx on public.supplier_purchases(firm_id, invoice_date desc);
create index if not exists supplier_purchases_supplier_idx on public.supplier_purchases(firm_id, supplier_id);
alter table public.supplier_purchases enable row level security;
drop policy if exists supplier_purchases_select on public.supplier_purchases;
create policy supplier_purchases_select on public.supplier_purchases for select using (firm_id = public.my_firm_id());
drop policy if exists supplier_purchases_insert on public.supplier_purchases;
create policy supplier_purchases_insert on public.supplier_purchases for insert with check (firm_id = public.my_firm_id());
drop policy if exists supplier_purchases_update on public.supplier_purchases;
create policy supplier_purchases_update on public.supplier_purchases for update using (firm_id = public.my_firm_id()) with check (firm_id = public.my_firm_id());
drop policy if exists supplier_purchases_delete on public.supplier_purchases;
create policy supplier_purchases_delete on public.supplier_purchases for delete using (firm_id = public.my_firm_id());
