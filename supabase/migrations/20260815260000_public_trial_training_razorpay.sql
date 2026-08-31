-- Public 14-day trial, commercial leads, tutorial progress, Razorpay idempotent capture
-- V1 freeze prerequisites — no new product scope

-- ============================================================================
-- 1. Platform trial configuration (default 14 days — not hardcoded in app logic)
-- ============================================================================
INSERT INTO public.platform_settings (key, value, updated_at)
VALUES
  ('licensing.default_trial_days', '14'::jsonb, now()),
  ('licensing.default_trial_product_id', '"ORNEXA"'::jsonb, now()),
  ('licensing.default_trial_plan_code', '"trial-14d"'::jsonb, now()),
  ('licensing.trial_follow_up_day_2', '2'::jsonb, now()),
  ('licensing.trial_follow_up_day_7', '7'::jsonb, now()),
  ('licensing.trial_expiry_warning_days', '3'::jsonb, now())
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.platform_plans (code, name, description, billing_cycle, price_minor, feature_limits, is_active)
VALUES (
  'trial-14d',
  '14-Day Ornexa Trial',
  'Public self-serve trial — full Ornexa access for configured trial duration.',
  'custom',
  0,
  '{"product_id":"ORNEXA","trial":true}'::jsonb,
  true
)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- 2. Trial lifecycle on subscriptions (product-aware)
-- ============================================================================
ALTER TABLE public.organization_subscriptions
  ADD COLUMN IF NOT EXISTS product_id TEXT REFERENCES public.avs_products(id),
  ADD COLUMN IF NOT EXISTS trial_lifecycle_status TEXT NOT NULL DEFAULT 'TRIAL_ACTIVE'
    CHECK (trial_lifecycle_status IN (
      'TRIAL_ACTIVE','TRIAL_EXPIRING','TRIAL_EXPIRED','CONVERTED','EXTENDED','CANCELLED'
    ));

UPDATE public.organization_subscriptions
SET product_id = COALESCE(product_id, 'ORNEXA')
WHERE product_id IS NULL;

-- ============================================================================
-- 3. Platform commercial leads (trial signup → sales pipeline)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.platform_commercial_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  product_id TEXT NOT NULL REFERENCES public.avs_products(id) DEFAULT 'ORNEXA',
  company_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  lead_stage TEXT NOT NULL DEFAULT 'new_trial'
    CHECK (lead_stage IN (
      'new_trial','contact_pending','contacted','demo_scheduled',
      'negotiation','proposal','won','lost'
    )),
  trial_started_at TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  last_active_at TIMESTAMPTZ,
  sales_owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  follow_up_due_at TIMESTAMPTZ,
  notes TEXT,
  source TEXT NOT NULL DEFAULT 'public_trial',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_leads_stage ON public.platform_commercial_leads (lead_stage, trial_ends_at);
CREATE INDEX IF NOT EXISTS idx_platform_leads_org ON public.platform_commercial_leads (organization_id);

ALTER TABLE public.platform_commercial_leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS platform_commercial_leads_admin ON public.platform_commercial_leads;
CREATE POLICY platform_commercial_leads_admin ON public.platform_commercial_leads
  FOR ALL TO authenticated
  USING (public.is_saas_admin())
  WITH CHECK (public.is_saas_admin());

-- ============================================================================
-- 4. Tutorial / guided tour progress (persisted per user)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_tutorial_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  firm_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  module_code TEXT NOT NULL,
  progress_percentage INTEGER NOT NULL DEFAULT 0 CHECK (progress_percentage BETWEEN 0 AND 100),
  current_step_index INTEGER NOT NULL DEFAULT 0,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  role_context TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_user_tutorial_module UNIQUE (user_id, module_code)
);

ALTER TABLE public.user_tutorial_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_tutorial_progress_self ON public.user_tutorial_progress;
CREATE POLICY user_tutorial_progress_self ON public.user_tutorial_progress
  FOR ALL TO authenticated
  USING (user_id = auth.uid() AND firm_id = public.my_firm_id())
  WITH CHECK (user_id = auth.uid() AND firm_id = public.my_firm_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_tutorial_progress TO authenticated;

-- ============================================================================
-- 5. Self-serve public trial provisioning (authenticated new user, one-time)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_platform_trial_days()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT (value #>> '{}')::integer FROM public.platform_settings WHERE key = 'licensing.default_trial_days'),
    14
  );
$$;

CREATE OR REPLACE FUNCTION public.provision_public_trial(
  p_firm_name text,
  p_firm_slug text,
  p_owner_full_name text,
  p_owner_phone text DEFAULT '',
  p_owner_email text DEFAULT '',
  p_product_id text DEFAULT 'ORNEXA',
  p_branch_name text DEFAULT 'Main Branch'
)
RETURNS TABLE (
  organization_id uuid,
  branch_id text,
  subscription_id uuid,
  lead_id uuid,
  trial_ends_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_id uuid := auth.uid();
  v_org_id uuid;
  v_branch_id text;
  v_plan_id uuid;
  v_sub_id uuid;
  v_lead_id uuid;
  v_trial_days integer;
  v_plan_code text;
  v_trial_end timestamptz;
  v_follow_up_day_2 integer;
BEGIN
  IF v_auth_id IS NULL THEN
    RAISE EXCEPTION 'provision_public_trial: authentication required';
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_profiles WHERE auth_id = v_auth_id) THEN
    RAISE EXCEPTION 'provision_public_trial: user already provisioned';
  END IF;
  IF trim(p_firm_name) = '' OR trim(p_firm_slug) = '' OR trim(p_owner_full_name) = '' THEN
    RAISE EXCEPTION 'provision_public_trial: company name, slug, and owner name are required';
  END IF;

  v_trial_days := public.get_platform_trial_days();
  SELECT COALESCE(value #>> '{}', 'trial-14d') INTO v_plan_code
  FROM public.platform_settings WHERE key = 'licensing.default_trial_plan_code';
  v_plan_code := trim(both '"' from v_plan_code);

  SELECT id INTO v_plan_id FROM public.platform_plans WHERE code = v_plan_code AND is_active;
  IF v_plan_id IS NULL THEN
    SELECT id INTO v_plan_id FROM public.platform_plans WHERE code = 'trial-14d' AND is_active;
  END IF;
  IF v_plan_id IS NULL THEN
    RAISE EXCEPTION 'provision_public_trial: no active trial plan configured';
  END IF;

  v_trial_end := now() + make_interval(days => v_trial_days);

  INSERT INTO public.organizations (slug, name, license_type, is_active, data)
  VALUES (p_firm_slug, p_firm_name, 'trial', true, jsonb_build_object('product_id', p_product_id))
  RETURNING id INTO v_org_id;

  v_branch_id := 'br_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
  INSERT INTO public.branches (id, firm_id, name, code, address, phone, manager_name, active, is_default, branch_type)
  VALUES (v_branch_id, v_org_id, p_branch_name, 'MAIN', '', p_owner_phone, p_owner_full_name, true, true, 'main');

  INSERT INTO public.user_profiles (id, auth_id, firm_id, branch_id, full_name, status, active, is_super_owner, role, data, permissions)
  VALUES (gen_random_uuid(), v_auth_id, v_org_id, v_branch_id, p_owner_full_name, 'active', true, true, 'Owner', '{}'::jsonb, '{}'::jsonb);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_auth_id, 'owner'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.organization_subscriptions (
    organization_id, plan_id, status, product_id,
    trial_started_at, trial_ends_at, trial_lifecycle_status
  )
  VALUES (v_org_id, v_plan_id, 'trial', p_product_id, now(), v_trial_end, 'TRIAL_ACTIVE')
  RETURNING id INTO v_sub_id;

  INSERT INTO public.subscription_history (organization_id, subscription_id, action, after_value, actor_id, reason)
  VALUES (
    v_org_id, v_sub_id, 'trial_started',
    jsonb_build_object('plan_code', v_plan_code, 'trial_days', v_trial_days, 'product_id', p_product_id),
    v_auth_id, 'Public self-serve trial signup'
  );

  SELECT COALESCE((value #>> '{}')::integer, 2) INTO v_follow_up_day_2
  FROM public.platform_settings WHERE key = 'licensing.trial_follow_up_day_2';

  INSERT INTO public.platform_commercial_leads (
    organization_id, product_id, company_name, contact_name, contact_email, contact_phone,
    lead_stage, trial_started_at, trial_ends_at, last_active_at, follow_up_due_at, source
  )
  VALUES (
    v_org_id, p_product_id, p_firm_name, p_owner_full_name,
    COALESCE(NULLIF(trim(p_owner_email), ''), (SELECT email FROM auth.users WHERE id = v_auth_id)),
    p_owner_phone, 'new_trial', now(), v_trial_end, now(),
    now() + make_interval(days => v_follow_up_day_2), 'public_trial'
  )
  RETURNING id INTO v_lead_id;

  PERFORM public.apply_plan_entitlements(v_org_id, v_plan_id, 'Public trial provisioning');

  RETURN QUERY SELECT v_org_id, v_branch_id, v_sub_id, v_lead_id, v_trial_end;
END;
$$;

REVOKE ALL ON FUNCTION public.provision_public_trial(text, text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.provision_public_trial(text, text, text, text, text, text, text) TO authenticated;

-- Re-grant extend_platform_trial to authenticated (function enforces saas_admin internally)
GRANT EXECUTE ON FUNCTION public.extend_platform_trial(uuid, integer, text) TO authenticated;

-- ============================================================================
-- 6. Razorpay webhook idempotent capture (prevents double-credit / double-post)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.process_razorpay_payment_captured(
  p_razorpay_event_id text,
  p_event_type text,
  p_payload jsonb,
  p_razorpay_payment_id text,
  p_razorpay_order_id text,
  p_amount_paise bigint,
  p_firm_id uuid,
  p_platform_invoice_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing uuid;
  v_payment_id uuid;
  v_invoice_id uuid;
BEGIN
  -- Idempotency: unique razorpay_event_id
  SELECT id INTO v_existing FROM public.webhook_events WHERE razorpay_event_id = p_razorpay_event_id;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true);
  END IF;

  INSERT INTO public.webhook_events (razorpay_event_id, event_type, payload, processed)
  VALUES (p_razorpay_event_id, p_event_type, p_payload, false);

  -- Idempotency: payment id
  SELECT id INTO v_payment_id FROM public.platform_payments WHERE razorpay_payment_id = p_razorpay_payment_id;
  IF v_payment_id IS NOT NULL THEN
    UPDATE public.webhook_events SET processed = true, processed_at = now() WHERE razorpay_event_id = p_razorpay_event_id;
    RETURN jsonb_build_object('ok', true, 'duplicate_payment', true);
  END IF;

  INSERT INTO public.platform_payments (
    firm_id, platform_invoice_id, razorpay_payment_id, razorpay_order_id,
    amount_paise, currency, status, captured_at, metadata
  )
  VALUES (
    p_firm_id, p_platform_invoice_id, p_razorpay_payment_id, p_razorpay_order_id,
    p_amount_paise, 'INR', 'CAPTURED', now(),
    jsonb_build_object('event_id', p_razorpay_event_id)
  )
  RETURNING id INTO v_payment_id;

  IF p_platform_invoice_id IS NOT NULL THEN
    UPDATE public.platform_invoices
    SET paid_paise = LEAST(total_paise, paid_paise + p_amount_paise),
        status = CASE WHEN paid_paise + p_amount_paise >= total_paise THEN 'paid' ELSE 'partially_paid' END,
        updated_at = now()
    WHERE id = p_platform_invoice_id
    RETURNING id INTO v_invoice_id;
  END IF;

  -- Credit top-up line items: grant credits once per payment
  IF p_platform_invoice_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.platform_invoice_items
    WHERE invoice_id = p_platform_invoice_id
      AND item_type IN ('credit_topup', 'whatsapp_topup', 'wallet_topup')
  ) THEN
    PERFORM public.grant_tenant_credits(
      (SELECT COALESCE(SUM((metadata->>'credits')::numeric), 0)
       FROM public.platform_invoice_items WHERE invoice_id = p_platform_invoice_id),
      'purchase',
      'Credit top-up via Razorpay',
      jsonb_build_object('razorpay_payment_id', p_razorpay_payment_id),
      p_firm_id
    );
  END IF;

  UPDATE public.webhook_events SET processed = true, processed_at = now() WHERE razorpay_event_id = p_razorpay_event_id;

  RETURN jsonb_build_object('ok', true, 'payment_id', v_payment_id, 'invoice_id', v_invoice_id);
END;
$$;

REVOKE ALL ON FUNCTION public.process_razorpay_payment_captured(text, text, jsonb, text, text, bigint, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_razorpay_payment_captured(text, text, jsonb, text, text, bigint, uuid, uuid) TO service_role;
