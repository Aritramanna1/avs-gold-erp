-- Migration: 20260703020000_stone_diamond_tracking.sql
-- Description: Stone & Diamond Tracking — per-stone records (carat, clarity,
-- certificate) linked to a finished stock item, for jewellery containing set
-- stones/diamonds that need individual certification traceability.

CREATE TABLE IF NOT EXISTS public.stock_stones (
  id                  TEXT PRIMARY KEY,
  branch_id           TEXT NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  item_id             TEXT REFERENCES public.inventory(id) ON DELETE SET NULL,
  stone_type          TEXT NOT NULL,
  certificate_number  TEXT,
  data                JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.stock_stones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "stock_stones_branch_isolation" ON public.stock_stones;
CREATE POLICY "stock_stones_branch_isolation" ON public.stock_stones
  FOR ALL TO authenticated USING (
    branch_id = ANY(public.get_user_branch_ids()) OR public.is_global_user()
  );

CREATE INDEX IF NOT EXISTS idx_stock_stones_branch ON public.stock_stones(branch_id);
CREATE INDEX IF NOT EXISTS idx_stock_stones_item ON public.stock_stones(item_id);
CREATE INDEX IF NOT EXISTS idx_stock_stones_certificate ON public.stock_stones(certificate_number);
