-- ==============================================================================
-- AVS ERP — Authoritative SaaS Subscription, Plan, Entitlement & S2S API Schema
-- Migration: 20260905_authoritative_subscription_and_s2s_api.sql
-- ==============================================================================

-- 1. Extend and Align platform_plans Table with Complete Plan Model
ALTER TABLE public.platform_plans
  ADD COLUMN IF NOT EXISTS monthly_price_paise BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS annual_price_paise BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS custom_price_supported BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS trial_days INTEGER NOT NULL DEFAULT 14,
  ADD COLUMN IF NOT EXISTS grace_days INTEGER NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS max_users INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS max_branches INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS max_storage_gb NUMERIC NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS portal_access BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS api_access BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reports_access BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS integrations_access BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_access BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_gateway_access BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS backup_access BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'draft', 'archived')),
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'INR';

-- Seed / Update Authoritative Standard Commercial Plans
INSERT INTO public.platform_plans (
  code, name, description, billing_cycle, price_minor,
  monthly_price_paise, annual_price_paise, custom_price_supported,
  trial_days, grace_days, max_users, max_branches, max_storage_gb,
  portal_access, api_access, reports_access, integrations_access,
  whatsapp_access, payment_gateway_access, backup_access, version, status, is_active
)
VALUES
  (
    'free_trial',
    'AVS Free Trial',
    '14-day full evaluation trial with standard operational modules',
    'monthly', 0,
    0, 0, false,
    14, 7, 3, 1, 5,
    true, false, false, false,
    false, false, true, 1, 'active', true
  ),
  (
    'avs_10k',
    'AVS Workshop Starter',
    'Entry workshop & retail ERP — stock, orders, workshop jobwork, gold ledger',
    'annual', 1000000,
    100000, 1000000, false,
    14, 7, 3, 1, 10,
    false, false, false, false,
    false, false, true, 1, 'active', true
  ),
  (
    'avs_30k',
    'AVS Manufacturing Standard',
    'Full manufacturing & showroom — GST e-invoicing, barcode tagging, customer portal',
    'annual', 3000000,
    280000, 3000000, false,
    14, 7, 10, 2, 25,
    true, true, true, false,
    true, true, true, 1, 'active', true
  ),
  (
    'avs_50k',
    'AVS Enterprise Pro',
    'Multi-branch, advanced analytics, karigar & supplier portals, automated cloud backups',
    'annual', 5000000,
    480000, 5000000, false,
    14, 7, 25, 5, 100,
    true, true, true, true,
    true, true, true, 1, 'active', true
  ),
  (
    'enterprise_custom',
    'AVS Custom Enterprise',
    'Tailored limits, dedicated multi-unit routing, bespoke workflows and custom SLAs',
    'annual', 10000000,
    1000000, 10000000, true,
    14, 7, 100, 20, 500,
    true, true, true, true,
    true, true, true, 1, 'active', true
  )
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  monthly_price_paise = EXCLUDED.monthly_price_paise,
  annual_price_paise = EXCLUDED.annual_price_paise,
  max_users = EXCLUDED.max_users,
  max_branches = EXCLUDED.max_branches,
  max_storage_gb = EXCLUDED.max_storage_gb,
  portal_access = EXCLUDED.portal_access,
  api_access = EXCLUDED.api_access,
  reports_access = EXCLUDED.reports_access,
  integrations_access = EXCLUDED.integrations_access,
  whatsapp_access = EXCLUDED.whatsapp_access,
  payment_gateway_access = EXCLUDED.payment_gateway_access,
  backup_access = EXCLUDED.backup_access,
  status = EXCLUDED.status,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- 2. Extend organization_subscriptions Table with Complete Subscription Model
ALTER TABLE public.organization_subscriptions
  ADD COLUMN IF NOT EXISTS plan_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS billing_interval TEXT NOT NULL DEFAULT 'annual' CHECK (billing_interval IN ('monthly', 'annual', 'custom')),
  ADD COLUMN IF NOT EXISTS amount_paise BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'INR',
  ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS grace_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS grace_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancel_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_payment_id UUID,
  ADD COLUMN IF NOT EXISTS last_invoice_id UUID,
  ADD COLUMN IF NOT EXISTS entitlements_override JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 3. Server-to-Server Service Keys Table for Public Website & Integration Authentication
CREATE TABLE IF NOT EXISTS public.platform_service_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_id TEXT NOT NULL UNIQUE,
  key_secret TEXT NOT NULL,
  name TEXT NOT NULL,
  service_name TEXT NOT NULL DEFAULT 'public_website',
  permissions JSONB NOT NULL DEFAULT '["subscription.read", "checkout.create", "payment.verify"]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

ALTER TABLE public.platform_service_keys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS platform_service_keys_saas_admin ON public.platform_service_keys;
CREATE POLICY platform_service_keys_saas_admin ON public.platform_service_keys
  FOR ALL TO authenticated
  USING (public.is_saas_admin())
  WITH CHECK (public.is_saas_admin());

-- Seed primary Public Website S2S Key if absent
INSERT INTO public.platform_service_keys (
  key_id, key_secret, name, service_name, permissions, is_active
)
VALUES (
  'avs_svc_pubsite_prod_v1',
  'avs_sec_993e1b7c4a6d2f8e0158a2d48074',
  'Public Website Payment & Subscription Gateway',
  'public_website',
  '["subscription.read", "subscription.plans", "checkout.create", "payment.verify", "payment.status"]'::jsonb,
  true
)
ON CONFLICT (key_id) DO NOTHING;

-- 4. Centralized Authoritative Entitlement Resolver Function
CREATE OR REPLACE FUNCTION public.get_authoritative_tenant_entitlements(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org RECORD;
  v_sub RECORD;
  v_plan RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_is_operational BOOLEAN := true;
  v_days_remaining INT := 0;
  v_status TEXT := 'none';
  v_limits JSONB;
  v_features JSONB;
BEGIN
  -- 1. Fetch organization
  SELECT id, slug, name, is_active INTO v_org
  FROM public.organizations
  WHERE id = p_tenant_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'tenant_not_found');
  END IF;

  -- 2. Fetch active subscription
  SELECT * INTO v_sub
  FROM public.organization_subscriptions
  WHERE organization_id = p_tenant_id;

  IF FOUND THEN
    v_status := v_sub.status;
    SELECT * INTO v_plan FROM public.platform_plans WHERE id = v_sub.plan_id;

    IF v_sub.status = 'trial' THEN
      v_days_remaining := GREATEST(0, EXTRACT(DAY FROM (COALESCE(v_sub.trial_ends_at, v_now) - v_now))::INT);
      v_is_operational := v_sub.trial_ends_at IS NULL OR v_sub.trial_ends_at >= v_now;
    ELSIF v_sub.status = 'active' THEN
      v_days_remaining := GREATEST(0, EXTRACT(DAY FROM (COALESCE(v_sub.renews_at, v_now) - v_now))::INT);
      v_is_operational := true;
    ELSIF v_sub.status = 'past_due' THEN
      v_is_operational := true;
    ELSE
      v_is_operational := false;
    END IF;
  ELSE
    -- Default trial plan lookup
    SELECT * INTO v_plan FROM public.platform_plans WHERE code = 'free_trial' LIMIT 1;
    v_status := 'trial';
    v_days_remaining := 14;
    v_is_operational := true;
  END IF;

  v_limits := jsonb_build_object(
    'max_branches', COALESCE(v_plan.max_branches, 1),
    'max_users', COALESCE(v_plan.max_users, 3),
    'max_storage_gb', COALESCE(v_plan.max_storage_gb, 5),
    'portal_access', COALESCE(v_plan.portal_access, true),
    'api_access', COALESCE(v_plan.api_access, false),
    'reports_access', COALESCE(v_plan.reports_access, true),
    'integrations_access', COALESCE(v_plan.integrations_access, false),
    'whatsapp_access', COALESCE(v_plan.whatsapp_access, false),
    'payment_gateway_access', COALESCE(v_plan.payment_gateway_access, false),
    'backup_access', COALESCE(v_plan.backup_access, true)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'tenant', jsonb_build_object(
      'tenant_id', v_org.id,
      'tenant_code', v_org.slug,
      'company_name', v_org.name,
      'is_active', v_org.is_active
    ),
    'subscription', jsonb_build_object(
      'subscription_id', v_sub.id,
      'plan_id', v_plan.id,
      'plan_code', v_plan.code,
      'plan_name', v_plan.name,
      'plan_version', COALESCE(v_sub.plan_version, v_plan.version, 1),
      'status', v_status,
      'billing_interval', COALESCE(v_sub.billing_interval, 'annual'),
      'amount_paise', COALESCE(v_sub.amount_paise, v_plan.annual_price_paise, 0),
      'currency', COALESCE(v_sub.currency, 'INR'),
      'starts_at', v_sub.starts_at,
      'renews_at', v_sub.renews_at,
      'trial_ends_at', v_sub.trial_ends_at,
      'is_operational', v_is_operational,
      'days_remaining', v_days_remaining
    ),
    'entitlements', v_limits
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_authoritative_tenant_entitlements(UUID) TO authenticated, service_role;

-- 5. S2S Helper: Authoritative Plan List
CREATE OR REPLACE FUNCTION public.s2s_get_public_plans()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plans JSONB;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'plan_id', p.id,
      'plan_code', p.code,
      'name', p.name,
      'description', p.description,
      'currency', p.currency,
      'monthly_price_paise', p.monthly_price_paise,
      'annual_price_paise', p.annual_price_paise,
      'monthly_price_inr', round(p.monthly_price_paise / 100.0, 2),
      'annual_price_inr', round(p.annual_price_paise / 100.0, 2),
      'custom_price_supported', p.custom_price_supported,
      'trial_days', p.trial_days,
      'grace_days', p.grace_days,
      'version', p.version,
      'limits', jsonb_build_object(
        'max_users', p.max_users,
        'max_branches', p.max_branches,
        'max_storage_gb', p.max_storage_gb,
        'portal_access', p.portal_access,
        'api_access', p.api_access,
        'reports_access', p.reports_access,
        'integrations_access', p.integrations_access,
        'whatsapp_access', p.whatsapp_access,
        'payment_gateway_access', p.payment_gateway_access,
        'backup_access', p.backup_access
      )
    ) ORDER BY p.annual_price_paise ASC
  ) INTO v_plans
  FROM public.platform_plans p
  WHERE p.status = 'active' AND p.is_active = true;

  RETURN jsonb_build_object('ok', true, 'plans', COALESCE(v_plans, '[]'::jsonb));
END;
$$;

GRANT EXECUTE ON FUNCTION public.s2s_get_public_plans() TO service_role;

-- 6. S2S Helper: Authoritative Checkout Order Creator
CREATE OR REPLACE FUNCTION public.s2s_create_checkout_order(
  p_tenant_id UUID,
  p_plan_code TEXT,
  p_billing_cycle TEXT DEFAULT 'annual',
  p_customer_name TEXT DEFAULT NULL,
  p_customer_email TEXT DEFAULT NULL,
  p_customer_phone TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org RECORD;
  v_plan RECORD;
  v_amount_paise BIGINT;
  v_invoice_id UUID;
  v_invoice_no TEXT;
  v_cycle TEXT := lower(trim(COALESCE(p_billing_cycle, 'annual')));
BEGIN
  -- 1. Validate Tenant
  SELECT id, slug, name INTO v_org
  FROM public.organizations
  WHERE id = p_tenant_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid tenant_id');
  END IF;

  -- 2. Validate Plan
  SELECT * INTO v_plan
  FROM public.platform_plans
  WHERE code = p_plan_code AND status = 'active' AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid or inactive plan_code');
  END IF;

  -- 3. Calculate Authoritative Price
  IF v_cycle = 'monthly' THEN
    v_amount_paise := v_plan.monthly_price_paise;
  ELSE
    v_cycle := 'annual';
    v_amount_paise := v_plan.annual_price_paise;
  END IF;

  IF v_amount_paise <= 0 AND v_plan.code <> 'free_trial' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Plan has no configured price');
  END IF;

  -- 4. Create Platform Commercial Invoice
  v_invoice_no := 'AVS-' || to_char(NOW(), 'YYMMDD') || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);

  INSERT INTO public.platform_invoices (
    invoice_no, firm_id, billing_name, billing_address, due_date,
    item_type, subtotal_paise, tax_paise, total_paise, paid_paise, balance_paise,
    status, terms, created_by
  )
  VALUES (
    v_invoice_no, v_org.id, COALESCE(p_customer_name, v_org.name),
    p_customer_email, CURRENT_DATE + 7,
    'licence', v_amount_paise, 0, v_amount_paise, 0, v_amount_paise,
    'sent', 'AVS SaaS Platform Subscription', NULL
  )
  RETURNING id INTO v_invoice_id;

  INSERT INTO public.platform_invoice_items (
    invoice_id, description, item_type, quantity, unit_price_paise, tax_rate_pct, amount_paise, metadata
  )
  VALUES (
    v_invoice_id,
    v_plan.name || ' (' || v_cycle || ' subscription)',
    'licence', 1, v_amount_paise, 0, v_amount_paise,
    jsonb_build_object(
      'plan_id', v_plan.id,
      'plan_code', v_plan.code,
      'plan_version', v_plan.version,
      'billing_cycle', v_cycle,
      'customer_email', p_customer_email,
      'customer_phone', p_customer_phone
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'tenant_id', v_org.id,
    'tenant_code', v_org.slug,
    'invoice_id', v_invoice_id,
    'invoice_no', v_invoice_no,
    'plan_id', v_plan.id,
    'plan_code', v_plan.code,
    'plan_name', v_plan.name,
    'plan_version', v_plan.version,
    'billing_cycle', v_cycle,
    'amount_paise', v_amount_paise,
    'amount_inr', round(v_amount_paise / 100.0, 2),
    'currency', v_plan.currency
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.s2s_create_checkout_order(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;

-- 7. S2S Helper: Authoritative Payment Verification & Entitlement Fulfillment
CREATE OR REPLACE FUNCTION public.s2s_verify_and_fulfill_payment(
  p_tenant_id UUID,
  p_invoice_id UUID,
  p_razorpay_payment_id TEXT,
  p_razorpay_order_id TEXT,
  p_amount_paise BIGINT,
  p_method TEXT DEFAULT 'razorpay'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice RECORD;
  v_item RECORD;
  v_plan RECORD;
  v_payment_id UUID;
  v_receipt_no TEXT;
  v_sub_id UUID;
  v_duration_interval INTERVAL;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  -- 1. Lock and verify invoice
  SELECT * INTO v_invoice
  FROM public.platform_invoices
  WHERE id = p_invoice_id AND firm_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invoice not found for tenant');
  END IF;

  -- 2. Idempotent check on razorpay_payment_id
  SELECT id INTO v_payment_id
  FROM public.platform_payments
  WHERE razorpay_payment_id = p_razorpay_payment_id;

  IF v_payment_id IS NULL THEN
    INSERT INTO public.platform_payments (
      firm_id, platform_invoice_id, razorpay_payment_id, razorpay_order_id,
      amount_paise, currency, status, captured_at, method, metadata
    )
    VALUES (
      p_tenant_id, p_invoice_id, p_razorpay_payment_id, p_razorpay_order_id,
      p_amount_paise, 'INR', 'CAPTURED', v_now, COALESCE(p_method, 'razorpay'),
      jsonb_build_object('source', 's2s_public_website')
    )
    RETURNING id INTO v_payment_id;
  END IF;

  -- 3. Update Invoice Balance & Status
  UPDATE public.platform_invoices
  SET
    paid_paise = LEAST(total_paise, paid_paise + p_amount_paise),
    balance_paise = GREATEST(0, total_paise - (paid_paise + p_amount_paise)),
    status = 'paid',
    updated_at = v_now
  WHERE id = p_invoice_id;

  -- 4. Allocate Invoice Line to Subscription
  FOR v_item IN SELECT * FROM public.platform_invoice_items WHERE invoice_id = p_invoice_id
  LOOP
    IF v_item.item_type = 'licence' THEN
      SELECT * INTO v_plan FROM public.platform_plans WHERE id = (v_item.metadata->>'plan_id')::UUID;
      IF NOT FOUND THEN
        SELECT * INTO v_plan FROM public.platform_plans WHERE code = COALESCE(v_item.metadata->>'plan_code', 'avs_30k') LIMIT 1;
      END IF;

      IF (v_item.metadata->>'billing_cycle') = 'monthly' THEN
        v_duration_interval := INTERVAL '30 days';
      ELSE
        v_duration_interval := INTERVAL '1 year';
      END IF;

      -- Upsert authoritative organization subscription
      INSERT INTO public.organization_subscriptions (
        organization_id, plan_id, plan_version, status,
        billing_interval, amount_paise, currency,
        starts_at, current_period_start, current_period_end, renews_at,
        last_payment_id, last_invoice_id, updated_at
      )
      VALUES (
        p_tenant_id, v_plan.id, COALESCE(v_plan.version, 1), 'active',
        COALESCE(v_item.metadata->>'billing_cycle', 'annual'), p_amount_paise, 'INR',
        v_now, v_now, v_now + v_duration_interval, v_now + v_duration_interval,
        v_payment_id, p_invoice_id, v_now
      )
      ON CONFLICT (organization_id) DO UPDATE SET
        plan_id = EXCLUDED.plan_id,
        plan_version = EXCLUDED.plan_version,
        status = 'active',
        billing_interval = EXCLUDED.billing_interval,
        amount_paise = EXCLUDED.amount_paise,
        starts_at = COALESCE(public.organization_subscriptions.starts_at, v_now),
        current_period_start = v_now,
        current_period_end = v_now + v_duration_interval,
        renews_at = v_now + v_duration_interval,
        last_payment_id = v_payment_id,
        last_invoice_id = p_invoice_id,
        updated_at = v_now
      RETURNING id INTO v_sub_id;

      -- Apply server-side entitlements
      PERFORM public.apply_plan_entitlements(p_tenant_id, v_plan.id, 'S2S Payment verified (' || p_razorpay_payment_id || ')');

      -- Record Subscription Audit Event
      INSERT INTO public.subscription_events (
        event_type, previous_tier, new_tier, previous_status, new_status,
        actor_email, source, provider_reference, notes, created_at
      )
      VALUES (
        'subscription.activated', 'free_trial', v_plan.code, 'trial', 'active',
        's2s_public_website', 's2s_api', p_razorpay_payment_id,
        'Activated ' || v_plan.name || ' via public checkout', v_now
      );
    END IF;
  END LOOP;

  -- 5. Issue Official Payment Receipt
  v_receipt_no := 'RCP-' || to_char(v_now, 'YYMMDD') || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
  INSERT INTO public.platform_receipts (
    receipt_no, firm_id, platform_invoice_id, platform_payment_id,
    amount_paise, payment_method, issued_at, metadata
  )
  VALUES (
    v_receipt_no, p_tenant_id, p_invoice_id, v_payment_id,
    p_amount_paise, COALESCE(p_method, 'razorpay'), v_now,
    jsonb_build_object('razorpay_payment_id', p_razorpay_payment_id, 'razorpay_order_id', p_razorpay_order_id)
  )
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object(
    'ok', true,
    'payment_id', v_payment_id,
    'invoice_id', p_invoice_id,
    'receipt_no', v_receipt_no,
    'subscription_id', v_sub_id,
    'plan_code', v_plan.code,
    'status', 'active',
    'renews_at', v_now + v_duration_interval
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.s2s_verify_and_fulfill_payment(UUID, UUID, TEXT, TEXT, BIGINT, TEXT) TO service_role;
