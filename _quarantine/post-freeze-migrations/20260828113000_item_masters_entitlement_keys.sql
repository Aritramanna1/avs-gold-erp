-- Extend valid feature keys for AVS ladder (item_masters, workshop, ledger, MTG, manubook)

CREATE OR REPLACE FUNCTION public.is_valid_feature_key(p_feature_key text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public
AS $$
  SELECT p_feature_key = ANY(ARRAY[
    'billing', 'manufacturing', 'job_work', 'gst', 'bullion', 'melt_account',
    'crm_communications', 'inventory', 'repairs', 'orders', 'attendance', 'payroll',
    'hr', 'loyalty_program', 'barcode', 'hardware_integration', 'whatsapp', 'email',
    'sms', 'customer_portal', 'supplier_management', 'reports', 'analytics', 'multi_branch',
    'api_access', 'karigar_portal', 'export',
    'workshop', 'ledger', 'item_masters', 'mtg_shell', 'manubook'
  ]);
$$;

-- Sync item_masters + MTG flags from platform_plans.feature_limits
CREATE OR REPLACE FUNCTION public.apply_plan_entitlements(
  p_organization_id uuid,
  p_plan_id uuid,
  p_reason text DEFAULT 'Plan entitlements applied'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_plan public.platform_plans;
  v_feature record;
  v_fl_key text;
  v_fl_val jsonb;
  v_applied integer := 0;
  v_disabled integer := 0;
  v_preserved integer := 0;
  v_integration_keys text[] := ARRAY[
    'api_access', 'karigar_portal', 'export', 'item_masters', 'customer_portal', 'mtg_shell', 'manubook'
  ];
BEGIN
  IF NOT public.is_saas_admin() THEN
    RAISE EXCEPTION 'platform admin role required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_plan FROM public.platform_plans WHERE id = p_plan_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'plan not found' USING ERRCODE = 'P0002';
  END IF;

  FOR v_feature IN
    SELECT pf.feature_key, pf.enabled
    FROM public.plan_features pf
    WHERE pf.plan_id = p_plan_id
  LOOP
    IF NOT public.is_valid_feature_key(v_feature.feature_key) THEN
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.organization_features of
      WHERE of.organization_id = p_organization_id
        AND of.feature_key = v_feature.feature_key
        AND of.source = 'manual'
    ) THEN
      v_preserved := v_preserved + 1;
      CONTINUE;
    END IF;

    INSERT INTO public.organization_features (organization_id, feature_key, enabled, source)
    VALUES (p_organization_id, v_feature.feature_key, v_feature.enabled, 'plan')
    ON CONFLICT (organization_id, feature_key) DO UPDATE
      SET enabled = excluded.enabled,
          source = CASE
            WHEN public.organization_features.source = 'manual' THEN 'manual'
            ELSE 'plan'
          END,
          updated_at = now()
    WHERE public.organization_features.source <> 'manual';

    v_applied := v_applied + 1;
  END LOOP;

  UPDATE public.organization_features of
  SET enabled = false, updated_at = now()
  WHERE of.organization_id = p_organization_id
    AND of.source = 'plan'
    AND of.feature_key NOT IN (
      SELECT pf.feature_key FROM public.plan_features pf WHERE pf.plan_id = p_plan_id
    );
  GET DIAGNOSTICS v_disabled = ROW_COUNT;

  FOREACH v_fl_key IN ARRAY v_integration_keys LOOP
    v_fl_val := v_plan.feature_limits -> v_fl_key;
    IF v_fl_val IS NULL THEN
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.organization_features of
      WHERE of.organization_id = p_organization_id
        AND of.feature_key = v_fl_key
        AND of.source = 'manual'
    ) THEN
      v_preserved := v_preserved + 1;
      CONTINUE;
    END IF;

    INSERT INTO public.organization_features (organization_id, feature_key, enabled, source)
    VALUES (
      p_organization_id,
      v_fl_key,
      CASE WHEN jsonb_typeof(v_fl_val) = 'boolean' THEN (v_fl_val #>> '{}')::boolean ELSE false END,
      'plan'
    )
    ON CONFLICT (organization_id, feature_key) DO UPDATE
      SET enabled = excluded.enabled,
          source = CASE
            WHEN public.organization_features.source = 'manual' THEN 'manual'
            ELSE 'plan'
          END,
          updated_at = now()
    WHERE public.organization_features.source <> 'manual';
  END LOOP;

  FOREACH v_fl_key IN ARRAY ARRAY['whatsapp', 'email', 'customer_portal', 'reports'] LOOP
    v_fl_val := v_plan.feature_limits -> v_fl_key;
    IF v_fl_val IS NULL OR jsonb_typeof(v_fl_val) <> 'boolean' THEN
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.organization_features of
      WHERE of.organization_id = p_organization_id
        AND of.feature_key = v_fl_key
        AND of.source = 'manual'
    ) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.organization_features (organization_id, feature_key, enabled, source)
    VALUES (p_organization_id, v_fl_key, (v_fl_val #>> '{}')::boolean, 'plan')
    ON CONFLICT (organization_id, feature_key) DO UPDATE
      SET enabled = excluded.enabled, updated_at = now()
    WHERE public.organization_features.source <> 'manual';
  END LOOP;

  RETURN jsonb_build_object(
    'applied', v_applied,
    'disabled', v_disabled,
    'preserved_manual', v_preserved,
    'plan_code', v_plan.code,
    'reason', p_reason
  );
END;
$$;
