-- Reconciled from production (project dqgrrafuoxaorvyrcuuh) on 2026-08-11 — this migration was applied directly to Supabase and had no local file until now.

-- people.id is TEXT; supplier_purchases.supplier_id was wrongly uuid — inserts failed for all vendors.
alter table public.supplier_purchases
  alter column supplier_id type text using supplier_id::text;

alter table public.supplier_purchases
  drop constraint if exists supplier_purchases_supplier_id_fkey;

alter table public.supplier_purchases
  add constraint supplier_purchases_supplier_id_fkey
  foreign key (supplier_id) references public.people(id) on delete restrict;

-- Optional audit column for gold settled at purchase time (also stored in data jsonb).
alter table public.supplier_purchases
  add column if not exists gold_paid_fine_mg bigint not null default 0;
