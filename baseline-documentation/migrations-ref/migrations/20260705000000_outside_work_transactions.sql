-- Migration: 20260705000000_outside_work_transactions.sql
-- Description: Outside Work (External Jeweller) workflow
-- (outside-work-store.ts) — records gold/material issued to and received
-- from external jewellers (chain makers, ball makers, KDM suppliers), keyed
-- by an optional order_id (Production Order link is optional in this
-- workflow) and worker_id (reused column, holds the outside jeweller's
-- person id).
--
-- Applied for real via the Supabase migration tool (not just written to
-- this file). RLS follows the same real, currently-applied pattern as
-- order_issues/worker_returns: a plain authenticated-user gate, not the
-- get_user_branch_ids()/is_global_user() functions (which do not exist in
-- the live database) used by some older local migration files in this
-- folder. Branch scoping is enforced at the application query layer.
CREATE TABLE IF NOT EXISTS public.outside_work_transactions (
  id          TEXT PRIMARY KEY,
  branch_id   TEXT,
  order_id    TEXT,
  worker_id   TEXT,
  data        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.outside_work_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "outside_work_transactions_authenticated_rw" ON public.outside_work_transactions;
CREATE POLICY "outside_work_transactions_authenticated_rw" ON public.outside_work_transactions
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_outside_work_transactions_order ON public.outside_work_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_outside_work_transactions_worker ON public.outside_work_transactions(worker_id);
