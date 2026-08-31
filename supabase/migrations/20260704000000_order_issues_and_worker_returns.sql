-- Migration: 20260704000000_order_issues_and_worker_returns.sql
-- Description: Worker Return workflow (worker-return-store.ts) — records
-- material/gold handed back by a worker against a Production Order.
--
-- NOTE: order_issues already has its own applied migration
-- (see remote migration history: add_order_gold_material_issues /
-- add_order_issues_structured_columns) — not recreated here.
--
-- NOTE on RLS: this project's real, currently-applied policies use a plain
-- "authenticated user" gate (`auth.uid() IS NOT NULL`), not the
-- get_user_branch_ids()/is_global_user() branch-scoping functions used by
-- some other local migration files in this folder — those functions do not
-- exist in the live database. Branch scoping for these tables is enforced
-- at the application query layer instead (see supabase-write.ts /
-- stock-store.ts's own `data->>branchId` filters), matching how
-- order_issues' own real policy already works. This migration was applied
-- for real via the Supabase migration tool, not just written to this file.
CREATE TABLE IF NOT EXISTS public.worker_returns (
  id          TEXT PRIMARY KEY,
  branch_id   TEXT,
  order_id    TEXT NOT NULL,
  worker_id   TEXT,
  data        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.worker_returns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "worker_returns_authenticated_rw" ON public.worker_returns;
CREATE POLICY "worker_returns_authenticated_rw" ON public.worker_returns
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_worker_returns_order ON public.worker_returns(order_id);
CREATE INDEX IF NOT EXISTS idx_worker_returns_worker ON public.worker_returns(worker_id);
