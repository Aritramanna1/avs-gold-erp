-- =====================================================================
-- Migration: 20260814233000_server_side_device_entitlement_gating.sql
-- Description: Server-Side Device Entitlement Validation in validate_license RPC
-- Authoritative Master Specs: DEVICE_ACCESS_MASTER.md, BUSINESS_PRODUCT_AND_ENTITLEMENT_MASTER.md
-- Milestone: M1 (Backend Security Hardening & Canonical Schema Alignments)
-- =====================================================================

-- 1. Ensure commercial plan tier features include client surfaces in plan_features
DO $$
DECLARE
  v_plan record;
  v_edition text;
BEGIN
  FOR v_plan IN SELECT id, code, edition_code FROM public.platform_plans
  LOOP
    v_edition := lower(coalesce(v_plan.edition_code, v_plan.code, ''));
    
    -- Basic Plan: Choose 1 (client.web OR client.desktop, NO Mobile)
    IF v_edition IN ('basic', 'manufacturing_starter', 'starter') THEN
      INSERT INTO public.plan_features (plan_id, feature_key, enabled)
      VALUES (v_plan.id, 'client.web', true), (v_plan.id, 'client.desktop', true), (v_plan.id, 'client.mobile', false)
      ON CONFLICT (plan_id, feature_key) DO UPDATE SET enabled = EXCLUDED.enabled;
    
    -- Growth Plan: Choose 1 (client.web OR client.desktop OR client.mobile)
    ELSIF v_edition IN ('growth', 'manufacturing_essential', 'essential') THEN
      INSERT INTO public.plan_features (plan_id, feature_key, enabled)
      VALUES (v_plan.id, 'client.web', true), (v_plan.id, 'client.desktop', true), (v_plan.id, 'client.mobile', true)
      ON CONFLICT (plan_id, feature_key) DO UPDATE SET enabled = EXCLUDED.enabled;
      
    -- Professional Plan: Choose 2 (client.web, client.desktop, client.mobile)
    ELSIF v_edition IN ('professional', 'manufacturing_standard', 'standard') THEN
      INSERT INTO public.plan_features (plan_id, feature_key, enabled)
      VALUES (v_plan.id, 'client.web', true), (v_plan.id, 'client.desktop', true), (v_plan.id, 'client.mobile', true)
      ON CONFLICT (plan_id, feature_key) DO UPDATE SET enabled = EXCLUDED.enabled;
      
    -- Scale Plan: Choose 2 (client.web, client.desktop, client.mobile)
    ELSIF v_edition IN ('scale', 'manufacturing_professional') THEN
      INSERT INTO public.plan_features (plan_id, feature_key, enabled)
      VALUES (v_plan.id, 'client.web', true), (v_plan.id, 'client.desktop', true), (v_plan.id, 'client.mobile', true)
      ON CONFLICT (plan_id, feature_key) DO UPDATE SET enabled = EXCLUDED.enabled;
      
    -- Max / Enterprise: All 3 Included (client.web + client.desktop + client.mobile)
    ELSIF v_edition IN ('max', 'manufacturing_enterprise', 'enterprise', 'developer', 'pilot') THEN
      INSERT INTO public.plan_features (plan_id, feature_key, enabled)
      VALUES (v_plan.id, 'client.web', true), (v_plan.id, 'client.desktop', true), (v_plan.id, 'client.mobile', true)
      ON CONFLICT (plan_id, feature_key) DO UPDATE SET enabled = EXCLUDED.enabled;
    END IF;
  END LOOP;
END $$;

-- 2. Enhanced validate_license RPC with client device surface validation
CREATE OR REPLACE FUNCTION public.validate_license(
  p_license_key text,
  p_device_id text,
  p_deployment_mode text,
  p_client_type text DEFAULT 'web'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_license public.licenses;
  v_entitlement jsonb;
  v_valid boolean;
  v_expiry_ms bigint;
  v_issued_ms bigint;
  v_message text;
  v_client_allowed boolean := true;
  v_normalized_client text := lower(trim(coalesce(p_client_type, 'web')));
  v_plan_edition text;
  v_firm_id uuid;
  v_feature_key text := 'client.' || v_normalized_client;
  v_feature_enabled boolean;
BEGIN
  SELECT * INTO v_license
  FROM public.licenses
  WHERE license_id = trim(p_license_key);

  IF NOT FOUND THEN
    RETURN json_build_object(
      'valid', false,
      'client_allowed', false,
      'message', 'Invalid license key.',
      'customerStatus', 'invalid'
    );
  END IF;

  v_valid := v_license.status = 'active'
    AND (v_license.expiry_date IS NULL OR v_license.expiry_date > now());

  v_plan_edition := lower(coalesce(v_license.edition, 'basic'));
  v_firm_id := v_license.organization_id;

  -- Validate client surface entitlement against tenant organization features / plan tier
  IF v_firm_id IS NOT NULL THEN
    SELECT enabled INTO v_feature_enabled
    FROM public.organization_features
    WHERE organization_id = v_firm_id AND feature_key = v_feature_key;

    IF v_feature_enabled IS NOT NULL THEN
      v_client_allowed := v_feature_enabled;
    ELSE
      -- Fallback to commercial tier rules (DEVICE_ACCESS_MASTER.md §2)
      IF v_plan_edition IN ('basic', 'manufacturing_starter', 'starter') THEN
        -- Basic: Choose 1 (Web OR Desktop, NO Mobile)
        v_client_allowed := (v_normalized_client IN ('web', 'desktop'));
      ELSIF v_plan_edition IN ('growth', 'manufacturing_essential', 'essential') THEN
        -- Growth: Choose 1 (Web OR Desktop OR Mobile)
        v_client_allowed := (v_normalized_client IN ('web', 'desktop', 'mobile'));
      ELSIF v_plan_edition IN ('professional', 'manufacturing_standard', 'standard', 'scale', 'manufacturing_professional') THEN
        -- Professional / Scale: Choose 2
        v_client_allowed := (v_normalized_client IN ('web', 'desktop', 'mobile'));
      ELSIF v_plan_edition IN ('max', 'manufacturing_enterprise', 'enterprise', 'developer', 'pilot') THEN
        -- Max / Enterprise: All 3 Included
        v_client_allowed := true;
      ELSE
        v_client_allowed := (v_normalized_client IN ('web', 'desktop'));
      END IF;
    END IF;
  ELSE
    -- Unassigned license fallback
    IF v_plan_edition IN ('basic', 'manufacturing_starter', 'starter') AND v_normalized_client = 'mobile' THEN
      v_client_allowed := false;
    ELSE
      v_client_allowed := true;
    END IF;
  END IF;

  IF NOT v_client_allowed THEN
    v_valid := false;
    v_message := 'CLIENT_NOT_ENTITLED: Surface ' || v_normalized_client || ' is not licensed for tier ' || v_plan_edition;
  ELSIF v_license.status != 'active' THEN
    v_message := 'License is ' || v_license.status;
  ELSIF v_license.expiry_date IS NOT NULL AND v_license.expiry_date <= now() THEN
    v_message := 'License has expired';
  ELSE
    v_message := 'License is valid';
  END IF;

  v_expiry_ms := CASE
    WHEN v_license.expiry_date IS NULL THEN NULL
    ELSE (extract(epoch FROM v_license.expiry_date) * 1000)::bigint
  END;

  v_issued_ms := (extract(epoch FROM coalesce(v_license.created_at, now())) * 1000)::bigint;

  BEGIN
    v_entitlement := v_license.payload::jsonb;
  EXCEPTION WHEN OTHERS THEN
    v_entitlement := '{}'::jsonb;
  END;

  v_entitlement := v_entitlement
    || jsonb_build_object(
      'licenseId', v_license.license_id,
      'keyId', 'platform',
      'deviceId', coalesce(nullif(trim(p_device_id), ''), '*'),
      'clientType', v_normalized_client,
      'clientAllowed', v_client_allowed,
      'status', CASE WHEN v_valid THEN 'active' ELSE 'expired' END,
      'issuedAt', v_issued_ms,
      'notBefore', v_issued_ms,
      'expiresAt', v_expiry_ms,
      'seats', v_license.seats,
      'edition', v_license.edition,
      'customerStatus', v_license.status
    );

  RETURN json_build_object(
    'valid', v_valid,
    'client_allowed', v_client_allowed,
    'edition', v_license.edition,
    'expiry', v_license.expiry_date,
    'maximumDevices', v_license.seats,
    'customerStatus', v_license.status,
    'entitlement', v_entitlement,
    'signature', v_license.signature,
    'message', v_message
  );
END;
$$;

-- 3. Overloaded validate_license RPC taking tenant UUID and client type
CREATE OR REPLACE FUNCTION public.validate_license(
  p_tenant_id uuid,
  p_client_type text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sub public.organization_subscriptions;
  v_plan public.platform_plans;
  v_feature_enabled boolean;
  v_normalized_client text := lower(trim(coalesce(p_client_type, 'web')));
  v_feature_key text := 'client.' || v_normalized_client;
  v_client_allowed boolean := true;
  v_valid boolean := true;
  v_plan_tier text := 'basic';
  v_message text := 'Valid';
BEGIN
  SELECT * INTO v_sub FROM public.organization_subscriptions WHERE organization_id = p_tenant_id;
  IF FOUND THEN
    SELECT * INTO v_plan FROM public.platform_plans WHERE id = v_sub.plan_id;
    IF FOUND THEN
      v_plan_tier := coalesce(v_plan.edition_code, v_plan.code, 'basic');
    END IF;

    IF v_sub.status != 'active' AND v_sub.status != 'trial' THEN
      v_valid := false;
      v_message := 'Subscription status is ' || v_sub.status;
    END IF;
  END IF;

  SELECT enabled INTO v_feature_enabled
  FROM public.organization_features
  WHERE organization_id = p_tenant_id AND feature_key = v_feature_key;

  IF v_feature_enabled IS NOT NULL THEN
    v_client_allowed := v_feature_enabled;
  ELSE
    IF lower(v_plan_tier) IN ('basic', 'manufacturing_starter', 'starter') THEN
      v_client_allowed := (v_normalized_client IN ('web', 'desktop'));
    ELSIF lower(v_plan_tier) IN ('growth', 'manufacturing_essential', 'essential') THEN
      v_client_allowed := (v_normalized_client IN ('web', 'desktop', 'mobile'));
    ELSIF lower(v_plan_tier) IN ('professional', 'manufacturing_standard', 'standard', 'scale', 'manufacturing_professional') THEN
      v_client_allowed := (v_normalized_client IN ('web', 'desktop', 'mobile'));
    ELSIF lower(v_plan_tier) IN ('max', 'manufacturing_enterprise', 'enterprise', 'developer', 'pilot') THEN
      v_client_allowed := true;
    ELSE
      v_client_allowed := (v_normalized_client IN ('web', 'desktop'));
    END IF;
  END IF;

  IF NOT v_client_allowed THEN
    v_valid := false;
    v_message := 'CLIENT_NOT_ENTITLED: Surface ' || v_normalized_client || ' is not licensed for tier ' || v_plan_tier;
  END IF;

  RETURN jsonb_build_object(
    'valid', v_valid,
    'plan_tier', v_plan_tier,
    'client_allowed', v_client_allowed,
    'message', v_message
  );
END;
$$;

REVOKE ALL ON FUNCTION public.validate_license(text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.validate_license(text, text, text, text) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.validate_license(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.validate_license(uuid, text) TO anon, authenticated, service_role;
