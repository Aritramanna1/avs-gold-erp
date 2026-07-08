-- Migration: 20260703000000_financial_lock_and_stock_verification.sql
-- Description: Financial Lock Periods (month-end closing) + Physical Stock Verification counts.

-- 1. FINANCIAL LOCK PERIODS
-- One row per (branch, period). period is "YYYY-MM". Once locked, no financial or
-- gold-ledger posting dated inside that period may be created/edited/deleted —
-- enforced in application code (see src/lib/financial-lock-store.ts), not by DB
-- trigger, since postings span many tables.
CREATE TABLE IF NOT EXISTS public.financial_lock_periods (
  id          TEXT PRIMARY KEY,
  branch_id   TEXT NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  period      TEXT NOT NULL, -- "YYYY-MM"
  data        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (branch_id, period)
);

ALTER TABLE public.financial_lock_periods ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "financial_lock_periods_branch_isolation" ON public.financial_lock_periods;
CREATE POLICY "financial_lock_periods_branch_isolation" ON public.financial_lock_periods
  FOR ALL TO authenticated USING (
    branch_id = ANY(public.get_user_branch_ids()) OR public.is_global_user()
  );

CREATE INDEX IF NOT EXISTS idx_financial_lock_periods_branch ON public.financial_lock_periods(branch_id);
CREATE INDEX IF NOT EXISTS idx_financial_lock_periods_period ON public.financial_lock_periods(period);

-- 2. PHYSICAL STOCK VERIFICATION (cycle counts / annual stock-take)
CREATE TABLE IF NOT EXISTS public.physical_stock_counts (
  id          TEXT PRIMARY KEY,
  branch_id   TEXT NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'cancelled')),
  data        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.physical_stock_counts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "physical_stock_counts_branch_isolation" ON public.physical_stock_counts;
CREATE POLICY "physical_stock_counts_branch_isolation" ON public.physical_stock_counts
  FOR ALL TO authenticated USING (
    branch_id = ANY(public.get_user_branch_ids()) OR public.is_global_user()
  );

CREATE INDEX IF NOT EXISTS idx_physical_stock_counts_branch ON public.physical_stock_counts(branch_id);
CREATE INDEX IF NOT EXISTS idx_physical_stock_counts_status ON public.physical_stock_counts(status);
