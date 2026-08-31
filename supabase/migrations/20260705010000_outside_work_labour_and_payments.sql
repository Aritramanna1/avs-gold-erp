-- Migration: 20260705010000_outside_work_labour_and_payments.sql
-- Description: Outside Work Labour, Billing & Payment tracking
-- (outside-work-labour-store.ts) — labour charges billed by external
-- jewellers and payments made against them. Settlement itself reuses the
-- existing gold_settlements table (see gold-settlement-store.ts /
-- supabase-services.ts's GoldSettlementRecord, extended with
-- "outside_work_gold_settlement"/"outside_work_labour_settlement" types and
-- an optional labour_component_paise field carried inside the JSONB `data`
-- column — no new table needed for settlements).
--
-- Applied for real via the Supabase migration tool. Same real RLS pattern
-- as every other outside-work-*/order_issues/worker_returns table in this
-- folder: a plain authenticated-user gate, not the
-- get_user_branch_ids()/is_global_user() functions (which do not exist in
-- the live database).
CREATE TABLE IF NOT EXISTS public.outside_work_labour_charges (
  id          TEXT PRIMARY KEY,
  branch_id   TEXT,
  order_id    TEXT,
  worker_id   TEXT,
  data        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.outside_work_labour_charges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "outside_work_labour_charges_authenticated_rw" ON public.outside_work_labour_charges;
CREATE POLICY "outside_work_labour_charges_authenticated_rw" ON public.outside_work_labour_charges
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_outside_work_labour_charges_order ON public.outside_work_labour_charges(order_id);
CREATE INDEX IF NOT EXISTS idx_outside_work_labour_charges_worker ON public.outside_work_labour_charges(worker_id);

CREATE TABLE IF NOT EXISTS public.outside_work_payments (
  id          TEXT PRIMARY KEY,
  branch_id   TEXT,
  order_id    TEXT,
  worker_id   TEXT,
  data        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.outside_work_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "outside_work_payments_authenticated_rw" ON public.outside_work_payments;
CREATE POLICY "outside_work_payments_authenticated_rw" ON public.outside_work_payments
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_outside_work_payments_order ON public.outside_work_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_outside_work_payments_worker ON public.outside_work_payments(worker_id);
