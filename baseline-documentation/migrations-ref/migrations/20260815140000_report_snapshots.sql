-- =====================================================================
-- Migration: 20260815140000_report_snapshots.sql
-- Description: Immutable, hashed report snapshot store (REPORTING_ENGINE_MASTER.md section 4)
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.report_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    branch_id UUID NULL,
    report_type TEXT NOT NULL,
    params JSONB NOT NULL DEFAULT '{}'::jsonb,
    computed_rows JSONB NOT NULL DEFAULT '[]'::jsonb,
    totals JSONB NOT NULL DEFAULT '{}'::jsonb,
    row_hash TEXT NOT NULL,
    created_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_report_snapshots_firm_type
    ON public.report_snapshots(firm_id, report_type, created_at DESC);

ALTER TABLE public.report_snapshots ENABLE ROW LEVEL SECURITY;

-- Immutability: no UPDATE/DELETE policy is created, so no role can modify
-- or remove a saved snapshot once inserted (append-only, per spec).
CREATE POLICY report_snapshots_tenant_read ON public.report_snapshots
    FOR SELECT
    USING (firm_id = public.my_firm_id() OR public.is_saas_admin());

CREATE POLICY report_snapshots_tenant_insert ON public.report_snapshots
    FOR INSERT
    WITH CHECK (firm_id = public.my_firm_id() OR public.is_saas_admin());
