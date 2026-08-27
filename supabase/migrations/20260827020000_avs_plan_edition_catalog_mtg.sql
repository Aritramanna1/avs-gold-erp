-- Additive: AVS Price Plan × Business Edition catalog + MTG edition.
-- Does NOT rewrite existing plans' business logic or gold/ULE data.
-- Prices remain Owner-editable (seed price_minor = 0; never hardcode ₹ in app logic).
-- Extends is_valid_feature_key so apply_plan_entitlements can sync module keys.

BEGIN;

-- ── Columns on platform_plans ───────────────────────────────────────────────
ALTER TABLE public.platform_plans
  ADD COLUMN IF NOT EXISTS business_edition text,
  ADD COLUMN IF NOT EXISTS price_band_code text,
  ADD COLUMN IF NOT EXISTS edition_family text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'platform_plans_business_edition_chk'
  ) THEN
    ALTER TABLE public.platform_plans
      ADD CONSTRAINT platform_plans_business_edition_chk
      CHECK (
        business_edition IS NULL
        OR business_edition IN ('retail', 'manufacturing', 'full_erp')
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'platform_plans_price_band_chk'
  ) THEN
    ALTER TABLE public.platform_plans
      ADD CONSTRAINT platform_plans_price_band_chk
      CHECK (
        price_band_code IS NULL
        OR price_band_code IN ('band_10k', 'band_20k', 'band_30k', 'band_50k', 'band_mtg')
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'platform_plans_edition_family_chk'
  ) THEN
    ALTER TABLE public.platform_plans
      ADD CONSTRAINT platform_plans_edition_family_chk
      CHECK (
        edition_family IS NULL
        OR edition_family IN ('avs_standard', 'mtg')
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_platform_plans_business_edition
  ON public.platform_plans (business_edition)
  WHERE business_edition IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_platform_plans_edition_family
  ON public.platform_plans (edition_family)
  WHERE edition_family IS NOT NULL;

-- ── Expand valid feature keys (additive) ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_valid_feature_key(p_feature_key text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT p_feature_key = ANY(ARRAY[
    -- ERP module keys (module-store)
    'billing', 'manufacturing', 'job_work', 'gst', 'bullion', 'melt_account',
    'crm_communications', 'inventory', 'repairs', 'orders', 'attendance', 'payroll',
    'hr', 'loyalty_program', 'barcode', 'hardware_integration', 'whatsapp', 'email',
    'sms', 'customer_portal', 'supplier_management', 'reports', 'analytics', 'multi_branch',
    'catalog', 'api_access', 'karigar_portal', 'export', 'supplier_portal',
    -- Device surfaces
    'client.web', 'client.desktop', 'client.mobile',
    -- Edition markers
    'edition.mtg', 'edition.retail', 'edition.manufacturing', 'edition.full_erp',
    -- Business.* aliases used by Ornexa plan builder (keep for compatibility)
    'business.core', 'business.people', 'business.orders', 'business.workshop',
    'business.workshop_advanced', 'business.workshop_full', 'business.ledger',
    'business.ledger_dual', 'business.billing_basic', 'business.billing_full',
    'business.billing_gst_einv', 'business.barcode', 'business.barcode_tagging',
    'business.reports_standard', 'business.reports_full', 'business.reports_analytics',
    'business.outside_work', 'business.melting_assay', 'business.hallmarking_huid',
    'business.stock_audit', 'business.stock_audit_rfid', 'business.tally_export',
    'business.ai_assistant', 'business.custom_templates', 'business.custom_formulas',
    'business.api_webhooks', 'business.encrypted_backups'
  ]);
$$;

-- ── Helper: upsert plan + features ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._seed_avs_commercial_plan(
  p_code text,
  p_name text,
  p_edition_code text,
  p_business_edition text,
  p_price_band text,
  p_edition_family text,
  p_description text,
  p_features text[]
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_feat text;
BEGIN
  INSERT INTO public.platform_plans (
    code, name, edition_code, description, billing_cycle, price_minor,
    commercial_config, feature_limits, branch_limit, user_limit, workshop_limit,
    is_active, publicly_visible, business_edition, price_band_code, edition_family,
    updated_at
  ) VALUES (
    p_code, p_name, p_edition_code, p_description, 'yearly', 0,
    jsonb_build_object(
      'currency', 'INR',
      'price_editable_by_owner', true,
      'amount_source', 'platform_plans.price_minor'
    ),
    jsonb_build_object('support_tier', 'standard'),
    1, 5, 2,
    true, false, p_business_edition, p_price_band, p_edition_family,
    now()
  )
  ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    edition_code = EXCLUDED.edition_code,
    description = EXCLUDED.description,
    business_edition = EXCLUDED.business_edition,
    price_band_code = EXCLUDED.price_band_code,
    edition_family = EXCLUDED.edition_family,
    commercial_config = EXCLUDED.commercial_config,
    updated_at = now()
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM public.platform_plans WHERE code = p_code;
  END IF;

  FOREACH v_feat IN ARRAY p_features LOOP
    IF public.is_valid_feature_key(v_feat) THEN
      INSERT INTO public.plan_features (plan_id, feature_key, enabled, updated_at)
      VALUES (v_id, v_feat, true, now())
      ON CONFLICT (plan_id, feature_key) DO UPDATE SET
        enabled = true,
        updated_at = now();
    END IF;
  END LOOP;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public._seed_avs_commercial_plan(text, text, text, text, text, text, text, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._seed_avs_commercial_plan(text, text, text, text, text, text, text, text[]) TO service_role;

DO $$
DECLARE
  -- Conservative baselines (module keys only). Owner matrix may expand later.
  f_retail_core text[] := ARRAY[
    'client.web', 'billing', 'gst', 'inventory', 'orders', 'repairs', 'catalog',
    'barcode', 'crm_communications', 'whatsapp', 'email', 'reports',
    'customer_portal', 'edition.retail'
  ];
  f_retail_mid text[] := ARRAY[
    'client.web', 'client.desktop', 'billing', 'gst', 'inventory', 'orders', 'repairs',
    'catalog', 'barcode', 'crm_communications', 'whatsapp', 'email', 'sms', 'reports',
    'analytics', 'customer_portal', 'loyalty_program', 'edition.retail'
  ];
  f_retail_top text[] := ARRAY[
    'client.web', 'client.desktop', 'client.mobile', 'billing', 'gst', 'inventory',
    'orders', 'repairs', 'catalog', 'barcode', 'crm_communications', 'whatsapp',
    'email', 'sms', 'reports', 'analytics', 'customer_portal', 'loyalty_program',
    'export', 'multi_branch', 'edition.retail'
  ];
  f_mfg_core text[] := ARRAY[
    'client.web', 'billing', 'inventory', 'orders', 'manufacturing', 'job_work',
    'bullion', 'melt_account', 'repairs', 'reports', 'karigar_portal',
    'crm_communications', 'edition.manufacturing'
  ];
  f_mfg_mid text[] := ARRAY[
    'client.web', 'client.desktop', 'billing', 'gst', 'inventory', 'orders',
    'manufacturing', 'job_work', 'bullion', 'melt_account', 'repairs', 'attendance',
    'payroll', 'barcode', 'reports', 'karigar_portal', 'customer_portal',
    'crm_communications', 'whatsapp', 'email', 'edition.manufacturing'
  ];
  f_mfg_top text[] := ARRAY[
    'client.web', 'client.desktop', 'client.mobile', 'billing', 'gst', 'inventory',
    'orders', 'manufacturing', 'job_work', 'bullion', 'melt_account', 'repairs',
    'attendance', 'payroll', 'hr', 'barcode', 'reports', 'analytics', 'export',
    'karigar_portal', 'customer_portal', 'supplier_management', 'supplier_portal',
    'crm_communications', 'whatsapp', 'email', 'sms', 'multi_branch',
    'edition.manufacturing'
  ];
  f_full text[] := ARRAY[
    'client.web', 'client.desktop', 'client.mobile', 'billing', 'gst', 'inventory',
    'orders', 'manufacturing', 'job_work', 'bullion', 'melt_account', 'repairs',
    'attendance', 'payroll', 'hr', 'catalog', 'barcode', 'hardware_integration',
    'reports', 'analytics', 'export', 'api_access', 'karigar_portal',
    'customer_portal', 'supplier_management', 'supplier_portal', 'crm_communications',
    'whatsapp', 'email', 'sms', 'loyalty_program', 'multi_branch', 'edition.full_erp'
  ];
  f_mtg text[] := ARRAY[
    'client.web', 'billing', 'inventory', 'orders', 'manufacturing', 'job_work',
    'bullion', 'melt_account', 'repairs', 'reports', 'karigar_portal',
    'customer_portal', 'crm_communications', 'whatsapp', 'attendance',
    'edition.mtg', 'edition.manufacturing'
  ];
BEGIN
  PERFORM public._seed_avs_commercial_plan(
    'AVS_10K_RETAIL', 'AVS 10K Retail', 'avs_10k_retail', 'retail', 'band_10k', 'avs_standard',
    'Retail-oriented AVS pack (price set by Platform Owner).', f_retail_core
  );
  PERFORM public._seed_avs_commercial_plan(
    'AVS_10K_MFG', 'AVS 10K Manufacturing', 'avs_10k_mfg', 'manufacturing', 'band_10k', 'avs_standard',
    'Manufacturing-oriented AVS pack (price set by Platform Owner).', f_mfg_core
  );
  PERFORM public._seed_avs_commercial_plan(
    'AVS_20K_RETAIL', 'AVS 20K Retail', 'avs_20k_retail', 'retail', 'band_20k', 'avs_standard',
    'Expanded retail AVS pack (price set by Platform Owner).', f_retail_mid
  );
  PERFORM public._seed_avs_commercial_plan(
    'AVS_20K_MFG', 'AVS 20K Manufacturing', 'avs_20k_mfg', 'manufacturing', 'band_20k', 'avs_standard',
    'Expanded manufacturing AVS pack (price set by Platform Owner).', f_mfg_mid
  );
  PERFORM public._seed_avs_commercial_plan(
    'AVS_30K_RETAIL', 'AVS 30K Retail', 'avs_30k_retail', 'retail', 'band_30k', 'avs_standard',
    'Advanced retail AVS pack (price set by Platform Owner).', f_retail_top
  );
  PERFORM public._seed_avs_commercial_plan(
    'AVS_30K_MFG', 'AVS 30K Manufacturing', 'avs_30k_mfg', 'manufacturing', 'band_30k', 'avs_standard',
    'Advanced manufacturing AVS pack (price set by Platform Owner).', f_mfg_top
  );
  PERFORM public._seed_avs_commercial_plan(
    'AVS_50K_FULL', 'AVS 50K Full ERP', 'avs_50k_full', 'full_erp', 'band_50k', 'avs_standard',
    'Full AVS ERP capability pack (price set by Platform Owner).', f_full
  );
  PERFORM public._seed_avs_commercial_plan(
    'AVS_MTG', 'MTG Workshop Edition', 'mtg', 'manufacturing', 'band_mtg', 'mtg',
    'MTG (Ma Tara) workshop edition — simple UI; AVS engines unchanged. Price set by Platform Owner.',
    f_mtg
  );
END $$;

-- Enrich get_my_tenant_entitlements with edition fields (additive JSON keys)
CREATE OR REPLACE FUNCTION public.get_my_tenant_entitlements()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_firm_id uuid := public.my_firm_id();
  v_sub public.organization_subscriptions;
  v_plan public.platform_plans;
  v_features jsonb := '{}'::jsonb;
  v_row record;
BEGIN
  IF v_firm_id IS NULL THEN
    RETURN jsonb_build_object(
      'features', '{}'::jsonb,
      'limits', '{}'::jsonb,
      'plan', null,
      'subscription', null,
      'edition_family', null,
      'business_edition', null
    );
  END IF;

  FOR v_row IN
    SELECT of.feature_key, of.enabled
    FROM public.organization_features of
    WHERE of.organization_id = v_firm_id
  LOOP
    v_features := v_features || jsonb_build_object(v_row.feature_key, v_row.enabled);
  END LOOP;

  SELECT * INTO v_sub FROM public.organization_subscriptions WHERE organization_id = v_firm_id;
  IF FOUND THEN
    SELECT * INTO v_plan FROM public.platform_plans WHERE id = v_sub.plan_id;
  END IF;

  RETURN jsonb_build_object(
    'features', v_features,
    'limits', public.get_organization_plan_limits(v_firm_id),
    'plan', CASE WHEN v_plan.id IS NOT NULL THEN to_jsonb(v_plan) ELSE null END,
    'subscription', CASE WHEN v_sub.organization_id IS NOT NULL THEN jsonb_build_object(
      'status', v_sub.status,
      'trial_ends_at', v_sub.trial_ends_at,
      'renews_at', v_sub.renews_at,
      'plan_id', v_sub.plan_id
    ) ELSE null END,
    'edition_family', v_plan.edition_family,
    'business_edition', v_plan.business_edition,
    'is_mtg', coalesce(v_plan.edition_family, '') = 'mtg'
      OR coalesce(v_features->>'edition.mtg', 'false') = 'true'
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_my_tenant_entitlements() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_tenant_entitlements() TO authenticated;

COMMIT;
