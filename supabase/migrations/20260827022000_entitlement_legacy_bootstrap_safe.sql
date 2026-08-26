-- Safety: do not lock legacy firms that have zero organization_features rows.
-- Also backfill plan entitlements for subscribed orgs missing feature rows.

BEGIN;

CREATE OR REPLACE FUNCTION public.tenant_module_write_allowed(p_feature_key text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_firm uuid := public.my_firm_id();
  v_has_any boolean;
BEGIN
  IF public.is_saas_admin() THEN
    RETURN true;
  END IF;

  IF v_firm IS NULL THEN
    RETURN false;
  END IF;

  -- Legacy bootstrap: no entitlement rows yet → do not block writes.
  SELECT EXISTS (
    SELECT 1 FROM public.organization_features of
    WHERE of.organization_id = v_firm
  ) INTO v_has_any;

  IF NOT v_has_any THEN
    RETURN true;
  END IF;

  RETURN public.organization_feature_enabled(p_feature_key);
END;
$function$;

REVOKE ALL ON FUNCTION public.tenant_module_write_allowed(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tenant_module_write_allowed(text) TO authenticated;

-- Backfill entitlements for subscribed orgs with no feature rows
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT os.organization_id, os.plan_id
    FROM public.organization_subscriptions os
    WHERE os.plan_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.organization_features of
        WHERE of.organization_id = os.organization_id
      )
  LOOP
    BEGIN
      PERFORM public.apply_plan_entitlements(
        r.organization_id,
        r.plan_id,
        'Backfill entitlements for legacy firm with empty organization_features'
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'backfill skipped for %: %', r.organization_id, SQLERRM;
    END;
  END LOOP;
END $$;

COMMIT;
