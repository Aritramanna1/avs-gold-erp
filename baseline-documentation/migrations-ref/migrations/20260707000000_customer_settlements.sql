-- Migration: 20260707000000_customer_settlements.sql
-- Description: Customer Settlement Draft → Delivery → Final Settlement
-- lifecycle (settlement-store.ts). Deliberately its own table, distinct
-- from gold_settlements (used for worker/vendor/outside-work settlements)
-- and from invoices (a Settlement generates an Invoice only at Final
-- Settlement — see completeFinalSettlement()).
--
-- Applied for real via the Supabase migration tool. Same real RLS pattern
-- as every other additive table in this folder: a plain authenticated-user
-- gate, not the get_user_branch_ids()/is_global_user() functions (which do
-- not exist in the live database).
CREATE TABLE IF NOT EXISTS public.customer_settlements (
  id          TEXT PRIMARY KEY,
  branch_id   TEXT,
  order_id    TEXT,
  worker_id   TEXT,
  data        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.customer_settlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customer_settlements_authenticated_rw" ON public.customer_settlements;
CREATE POLICY "customer_settlements_authenticated_rw" ON public.customer_settlements
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_customer_settlements_order ON public.customer_settlements(order_id);
