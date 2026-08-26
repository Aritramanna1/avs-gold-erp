-- Additive: RESTRICTIVE entitlement checks on gated write paths.
-- Multiple PERMISSIVE policies OR together — so entitlement must be RESTRICTIVE
-- to AND with existing firm-scoped staff policies.
-- Does not rewrite gold/ULE business law.

BEGIN;

CREATE OR REPLACE FUNCTION public.require_organization_feature(p_feature_key text)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.organization_feature_enabled(p_feature_key) THEN
    RAISE EXCEPTION 'feature_not_entitled:%', p_feature_key
      USING ERRCODE = '42501',
            HINT = 'Module disabled for this firm plan. Contact Platform Owner.';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.require_organization_feature(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.require_organization_feature(text) TO authenticated;

DO $$
BEGIN
  IF to_regclass('public.stock_items') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS stock_items_entitlement_restrict ON public.stock_items';
    EXECUTE $p$
      CREATE POLICY stock_items_entitlement_restrict ON public.stock_items
        AS RESTRICTIVE FOR ALL TO authenticated
        USING (public.tenant_module_write_allowed('inventory'))
        WITH CHECK (public.tenant_module_write_allowed('inventory'))
    $p$;
  END IF;

  IF to_regclass('public.orders') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS orders_entitlement_restrict ON public.orders';
    EXECUTE $p$
      CREATE POLICY orders_entitlement_restrict ON public.orders
        AS RESTRICTIVE FOR ALL TO authenticated
        USING (public.tenant_module_write_allowed('orders'))
        WITH CHECK (public.tenant_module_write_allowed('orders'))
    $p$;
  END IF;

  IF to_regclass('public.repair_orders') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS repair_orders_entitlement_restrict ON public.repair_orders';
    EXECUTE $p$
      CREATE POLICY repair_orders_entitlement_restrict ON public.repair_orders
        AS RESTRICTIVE FOR ALL TO authenticated
        USING (public.tenant_module_write_allowed('repairs'))
        WITH CHECK (public.tenant_module_write_allowed('repairs'))
    $p$;
  END IF;

  IF to_regclass('public.catalog_designs') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS catalog_designs_entitlement_restrict ON public.catalog_designs';
    EXECUTE $p$
      CREATE POLICY catalog_designs_entitlement_restrict ON public.catalog_designs
        AS RESTRICTIVE FOR ALL TO authenticated
        USING (public.tenant_module_write_allowed('catalog'))
        WITH CHECK (public.tenant_module_write_allowed('catalog'))
    $p$;
  END IF;

  IF to_regclass('public.attendance_records') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS attendance_records_entitlement_restrict ON public.attendance_records';
    EXECUTE $p$
      CREATE POLICY attendance_records_entitlement_restrict ON public.attendance_records
        AS RESTRICTIVE FOR ALL TO authenticated
        USING (public.tenant_module_write_allowed('attendance'))
        WITH CHECK (public.tenant_module_write_allowed('attendance'))
    $p$;
  END IF;
END $$;

-- Normalize any invalid feature sources (platform_override was rejected by CHECK)
UPDATE public.organization_features
SET source = 'manual'
WHERE source IS NOT NULL
  AND source NOT IN ('plan', 'manual', 'system');

COMMIT;
