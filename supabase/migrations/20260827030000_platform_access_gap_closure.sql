-- Platform Access gap closure (additive):
-- 1) Suspended subscriptions fail entitlement checks
-- 2) Firm-scoped feature helper for portal contexts
-- 3) Portal context gated by plan features
-- 4) RESTRICTIVE RLS on real write tables (repairs, job_cards, invoices, melt_jobs)
-- Does not invent OD matrix cells or change gold/ULE law.

BEGIN;

-- Firm-scoped entitlement check (used by portal + my_firm wrappers)
CREATE OR REPLACE FUNCTION public.organization_feature_enabled_for(
  p_organization_id uuid,
  p_feature_key text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_enabled boolean;
  v_sub_status text;
  v_has_any boolean;
BEGIN
  IF p_organization_id IS NULL OR p_feature_key IS NULL OR btrim(p_feature_key) = '' THEN
    RETURN false;
  END IF;

  SELECT os.status INTO v_sub_status
  FROM public.organization_subscriptions os
  WHERE os.organization_id = p_organization_id;

  -- Suspended / expired / cancelled / missing: deny module access.
  IF v_sub_status IS NULL OR v_sub_status NOT IN ('trial', 'active', 'past_due') THEN
    RETURN false;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.organization_features ofeat
    WHERE ofeat.organization_id = p_organization_id
  ) INTO v_has_any;

  -- Legacy bootstrap: subscribed but no feature rows yet → do not lock ERP.
  IF NOT v_has_any THEN
    RETURN true;
  END IF;

  SELECT ofeat.enabled INTO v_enabled
  FROM public.organization_features ofeat
  WHERE ofeat.organization_id = p_organization_id
    AND ofeat.feature_key = p_feature_key;

  IF FOUND THEN
    RETURN COALESCE(v_enabled, false);
  END IF;

  RETURN false;
END;
$function$;

REVOKE ALL ON FUNCTION public.organization_feature_enabled_for(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.organization_feature_enabled_for(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.organization_feature_enabled(p_feature_key text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN public.organization_feature_enabled_for(public.my_firm_id(), p_feature_key);
END;
$function$;

REVOKE ALL ON FUNCTION public.organization_feature_enabled(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.organization_feature_enabled(text) TO authenticated;

-- Keep write helper: saas admin bypass + empty-row bootstrap + feature check
CREATE OR REPLACE FUNCTION public.tenant_module_write_allowed(p_feature_key text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_firm uuid := public.my_firm_id();
BEGIN
  IF public.is_saas_admin() THEN
    RETURN true;
  END IF;

  IF v_firm IS NULL THEN
    RETURN false;
  END IF;

  RETURN public.organization_feature_enabled_for(v_firm, p_feature_key);
END;
$function$;

REVOKE ALL ON FUNCTION public.tenant_module_write_allowed(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tenant_module_write_allowed(text) TO authenticated;

-- Portal identity context: require matching plan feature for the firm
CREATE OR REPLACE FUNCTION public.get_my_portal_context(p_portal_type text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_identity public.portal_identities;
  v_parties jsonb;
  v_feature_key text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_identity
  FROM public.portal_identities pi
  WHERE pi.auth_user_id = auth.uid()
    AND pi.status = 'active'
    AND (p_portal_type IS NULL OR pi.portal_type = lower(p_portal_type))
  ORDER BY pi.updated_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  v_feature_key := CASE lower(v_identity.portal_type)
    WHEN 'customer' THEN 'customer_portal'
    WHEN 'supplier' THEN 'supplier_management'
    WHEN 'karigar' THEN 'karigar_portal'
    ELSE NULL
  END;

  IF v_feature_key IS NOT NULL
     AND NOT public.organization_feature_enabled_for(v_identity.firm_id, v_feature_key) THEN
    RAISE EXCEPTION 'feature_not_entitled:%', v_feature_key
      USING ERRCODE = '42501',
            HINT = 'Portal disabled for this firm plan. Contact Platform Owner.';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'party_id', ppl.party_id,
    'link_role', ppl.link_role,
    'allowed_branch_ids', ppl.allowed_branch_ids
  ) ORDER BY CASE WHEN ppl.link_role = 'primary' THEN 0 ELSE 1 END), '[]'::jsonb)
  INTO v_parties
  FROM public.portal_party_links ppl
  WHERE ppl.portal_identity_id = v_identity.id
    AND ppl.is_active = true;

  RETURN jsonb_build_object(
    'identity_id', v_identity.id,
    'firm_id', v_identity.firm_id,
    'portal_type', v_identity.portal_type,
    'branch_id', v_identity.branch_id,
    'party_links', v_parties
  );
END;
$function$;

-- RESTRICTIVE policies on real gated write tables
DO $$
BEGIN
  IF to_regclass('public.repairs') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS repairs_entitlement_restrict ON public.repairs';
    EXECUTE $p$
      CREATE POLICY repairs_entitlement_restrict ON public.repairs
        AS RESTRICTIVE FOR ALL TO authenticated
        USING (public.tenant_module_write_allowed('repairs'))
        WITH CHECK (public.tenant_module_write_allowed('repairs'))
    $p$;
  END IF;

  IF to_regclass('public.job_cards') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS job_cards_entitlement_restrict ON public.job_cards';
    EXECUTE $p$
      CREATE POLICY job_cards_entitlement_restrict ON public.job_cards
        AS RESTRICTIVE FOR ALL TO authenticated
        USING (public.tenant_module_write_allowed('manufacturing'))
        WITH CHECK (public.tenant_module_write_allowed('manufacturing'))
    $p$;
  END IF;

  IF to_regclass('public.invoices') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS invoices_entitlement_restrict ON public.invoices';
    EXECUTE $p$
      CREATE POLICY invoices_entitlement_restrict ON public.invoices
        AS RESTRICTIVE FOR ALL TO authenticated
        USING (public.tenant_module_write_allowed('billing'))
        WITH CHECK (public.tenant_module_write_allowed('billing'))
    $p$;
  END IF;

  IF to_regclass('public.melt_jobs') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS melt_jobs_entitlement_restrict ON public.melt_jobs';
    EXECUTE $p$
      CREATE POLICY melt_jobs_entitlement_restrict ON public.melt_jobs
        AS RESTRICTIVE FOR ALL TO authenticated
        USING (public.tenant_module_write_allowed('melt_account'))
        WITH CHECK (public.tenant_module_write_allowed('melt_account'))
    $p$;
  END IF;

  -- Drop mistaken policy target from earlier migration if it existed
  IF to_regclass('public.repair_orders') IS NULL THEN
    NULL; -- table never existed; prior IF guarded create
  END IF;
END $$;

COMMIT;
