-- Migration: 20260703010000_lot_batch_management.sql
-- Description: Lot & Batch Management — track raw-material/manufacturing lots
-- that finished stock items are received or produced under, for hallmark and
-- traceability purposes (which lot a given item came from).

CREATE TABLE IF NOT EXISTS public.stock_lots (
  id              TEXT PRIMARY KEY,
  branch_id       TEXT NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  lot_number      TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  data            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (branch_id, lot_number)
);

ALTER TABLE public.stock_lots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "stock_lots_branch_isolation" ON public.stock_lots;
CREATE POLICY "stock_lots_branch_isolation" ON public.stock_lots
  FOR ALL TO authenticated USING (
    branch_id = ANY(public.get_user_branch_ids()) OR public.is_global_user()
  );

CREATE INDEX IF NOT EXISTS idx_stock_lots_branch ON public.stock_lots(branch_id);
CREATE INDEX IF NOT EXISTS idx_stock_lots_status ON public.stock_lots(status);
