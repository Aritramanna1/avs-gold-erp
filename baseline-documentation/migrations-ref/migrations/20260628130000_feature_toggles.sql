-- Migration: 20260628130000_feature_toggles.sql
-- Description: Centralized system state table for enabled/disabled ERP modules per branch.

CREATE TABLE IF NOT EXISTS public.module_states (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id           TEXT NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  module_key          TEXT NOT NULL, -- e.g. 'billing', 'manufacturing', etc.
  enabled             BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(branch_id, module_key)
);

-- Enable RLS and isolate by branch
ALTER TABLE public.module_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "module_states_branch_isolation" ON public.module_states;
CREATE POLICY "module_states_branch_isolation" ON public.module_states
  FOR ALL TO authenticated USING (
    branch_id = ANY(public.get_user_branch_ids()) OR public.is_global_user()
  );

CREATE INDEX IF NOT EXISTS idx_module_states_branch ON public.module_states(branch_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.module_states TO authenticated;
