-- P0 fix, wave 2: full-audit pass found 20 MORE tables with zero firm scoping
-- that weren't in the original 37-table advisor list (they use a different
-- single-ALL-policy shape — "<table>_authenticated_rw" — from a migration
-- that predates the firm-scoping work entirely, so the earlier advisor scan
-- and the first RLS-fix pass both missed them). Several are gold/financial-
-- adjacent: material_vault_movements (non-gold material vault ledger),
-- manufacturing_barcodes (finished-goods ownership/traceability),
-- financial_lock_periods (period-close gate), worker_returns,
-- outside_work_* (outside-jeweller gold ledger), polishing_transactions.
--
-- None of these 20 tables have a firm_id column at all (verified via
-- information_schema). Adding it nullable, then applying the exact same
-- safe-fallback firm-scoped policy pattern as
-- 20260730160000_firm_scope_rls_framework.sql. No lockout today (everything
-- still null both sides); real isolation the moment Codex's tenant
-- onboarding backfills firm_id.
--
-- branches/workshops handled separately below — they have their own
-- admin-gated write policies (is_admin()) that need to keep that gate while
-- adding firm scope, not the generic 4-policy shape.

ALTER TABLE public.approval_requests ADD COLUMN IF NOT EXISTS firm_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.credit_notes ADD COLUMN IF NOT EXISTS firm_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.customer_settlements ADD COLUMN IF NOT EXISTS firm_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.debit_notes ADD COLUMN IF NOT EXISTS firm_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.delivery_challans ADD COLUMN IF NOT EXISTS firm_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.estimates ADD COLUMN IF NOT EXISTS firm_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.financial_lock_periods ADD COLUMN IF NOT EXISTS firm_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.lot_batches ADD COLUMN IF NOT EXISTS firm_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.manufacturing_barcodes ADD COLUMN IF NOT EXISTS firm_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.material_vault_movements ADD COLUMN IF NOT EXISTS firm_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.module_states ADD COLUMN IF NOT EXISTS firm_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.order_issues ADD COLUMN IF NOT EXISTS firm_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.outside_work_labour_charges ADD COLUMN IF NOT EXISTS firm_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.outside_work_payments ADD COLUMN IF NOT EXISTS firm_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.outside_work_transactions ADD COLUMN IF NOT EXISTS firm_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.polishing_transactions ADD COLUMN IF NOT EXISTS firm_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.saved_filters ADD COLUMN IF NOT EXISTS firm_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.stone_details ADD COLUMN IF NOT EXISTS firm_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.worker_returns ADD COLUMN IF NOT EXISTS firm_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.workshops ADD COLUMN IF NOT EXISTS firm_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

DO $$
DECLARE
  t text;
  pol text;
  tables text[] := ARRAY[
    'approval_requests','credit_notes','customer_settlements','debit_notes','delivery_challans',
    'estimates','financial_lock_periods','lot_batches','manufacturing_barcodes',
    'material_vault_movements','module_states','order_issues','outside_work_labour_charges',
    'outside_work_payments','outside_work_transactions','polishing_transactions','saved_filters',
    'stone_details','worker_returns'
  ];
  same_firm text := '(firm_id = public.my_firm_id() OR (firm_id IS NULL AND public.my_firm_id() IS NULL) OR public.has_role(auth.uid(), ''saas_admin''::public.app_role))';
BEGIN
  FOREACH t IN ARRAY tables LOOP
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol, t);
    END LOOP;
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (auth.uid() IS NOT NULL AND %s) WITH CHECK (auth.uid() IS NOT NULL AND %s)',
      t||'_authenticated_rw', t, same_firm, same_firm
    );
  END LOOP;
END $$;

-- branches / workshops: keep the existing is_admin() write gate, add firm
-- scope to it and to the open "select true for any authenticated user" read
-- policy (both currently let any signed-in user, from any firm, read every
-- firm's branches/workshops).
DROP POLICY IF EXISTS branches_select ON public.branches;
CREATE POLICY branches_select ON public.branches FOR SELECT TO authenticated
  USING (firm_id = public.my_firm_id() OR (firm_id IS NULL AND public.my_firm_id() IS NULL) OR public.has_role(auth.uid(), 'saas_admin'::public.app_role));

DROP POLICY IF EXISTS branches_admin_insert ON public.branches;
CREATE POLICY branches_admin_insert ON public.branches FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()) AND (firm_id = public.my_firm_id() OR (firm_id IS NULL AND public.my_firm_id() IS NULL)));

DROP POLICY IF EXISTS branches_admin_update ON public.branches;
CREATE POLICY branches_admin_update ON public.branches FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) AND (firm_id = public.my_firm_id() OR (firm_id IS NULL AND public.my_firm_id() IS NULL)))
  WITH CHECK (public.is_admin(auth.uid()) AND (firm_id = public.my_firm_id() OR (firm_id IS NULL AND public.my_firm_id() IS NULL)));

DROP POLICY IF EXISTS branches_admin_delete ON public.branches;
CREATE POLICY branches_admin_delete ON public.branches FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) AND (firm_id = public.my_firm_id() OR (firm_id IS NULL AND public.my_firm_id() IS NULL)));

DROP POLICY IF EXISTS workshops_select ON public.workshops;
CREATE POLICY workshops_select ON public.workshops FOR SELECT TO authenticated
  USING (firm_id = public.my_firm_id() OR (firm_id IS NULL AND public.my_firm_id() IS NULL) OR public.has_role(auth.uid(), 'saas_admin'::public.app_role));

DROP POLICY IF EXISTS workshops_admin_insert ON public.workshops;
CREATE POLICY workshops_admin_insert ON public.workshops FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()) AND (firm_id = public.my_firm_id() OR (firm_id IS NULL AND public.my_firm_id() IS NULL)));

DROP POLICY IF EXISTS workshops_admin_update ON public.workshops;
CREATE POLICY workshops_admin_update ON public.workshops FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) AND (firm_id = public.my_firm_id() OR (firm_id IS NULL AND public.my_firm_id() IS NULL)))
  WITH CHECK (public.is_admin(auth.uid()) AND (firm_id = public.my_firm_id() OR (firm_id IS NULL AND public.my_firm_id() IS NULL)));

DROP POLICY IF EXISTS workshops_admin_delete ON public.workshops;
CREATE POLICY workshops_admin_delete ON public.workshops FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) AND (firm_id = public.my_firm_id() OR (firm_id IS NULL AND public.my_firm_id() IS NULL)));
