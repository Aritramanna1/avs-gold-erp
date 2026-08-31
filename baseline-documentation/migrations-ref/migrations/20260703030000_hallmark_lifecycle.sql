-- Migration: 20260703030000_hallmark_lifecycle.sql
-- Description: Hallmark Lifecycle — track batches of finished stock items
-- sent to a BIS assay/hallmarking center and their return with HUID/
-- certificate, or rejection.

CREATE TABLE IF NOT EXISTS public.hallmark_batches (
  id            TEXT PRIMARY KEY,
  branch_id     TEXT NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  batch_number  TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'partially_received', 'received', 'closed')),
  data          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (branch_id, batch_number)
);

ALTER TABLE public.hallmark_batches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "hallmark_batches_branch_isolation" ON public.hallmark_batches;
CREATE POLICY "hallmark_batches_branch_isolation" ON public.hallmark_batches
  FOR ALL TO authenticated USING (
    branch_id = ANY(public.get_user_branch_ids()) OR public.is_global_user()
  );

CREATE INDEX IF NOT EXISTS idx_hallmark_batches_branch ON public.hallmark_batches(branch_id);
CREATE INDEX IF NOT EXISTS idx_hallmark_batches_status ON public.hallmark_batches(status);
