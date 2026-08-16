-- Multi-tenant identity, active business context, and subscription access engine.
-- ONE auth identity → many tenant/product memberships → one active context at a time.
-- Replaces single-firm user_profiles constraint and licence-key runtime authority.

BEGIN;

-- ---------------------------------------------------------------------------
-- PART 1: Allow multiple firm memberships per auth identity
-- ---------------------------------------------------------------------------

ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_auth_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_profiles_auth_firm
  ON public.user_profiles (auth_id, firm_id)
  WHERE firm_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- PART 2: Canonical membership + active context + preferences
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.tenant_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL DEFAULT 'ORNEXA',
  membership_kind TEXT NOT NULL DEFAULT 'internal'
    CHECK (membership_kind IN ('internal', 'portal')),
  portal_type TEXT CHECK (portal_type IN ('customer', 'karigar', 'supplier', 'external', 'ceo')),
  portal_type_key TEXT GENERATED ALWAYS AS (COALESCE(portal_type, '')) STORED,
  role TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('pending', 'active', 'suspended', 'revoked')),
  user_profile_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  portal_identity_id UUID REFERENCES public.portal_identities(id) ON DELETE SET NULL,
  branch_ids TEXT[],
  invited_by UUID,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_active_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tenant_membership
  ON public.tenant_memberships (
    auth_user_id, organization_id, product_id, membership_kind, portal_type_key
  );

CREATE INDEX IF NOT EXISTS idx_tenant_memberships_auth
  ON public.tenant_memberships (auth_user_id, status);
CREATE INDEX IF NOT EXISTS idx_tenant_memberships_org
  ON public.tenant_memberships (organization_id, product_id, status);

CREATE TABLE IF NOT EXISTS public.identity_active_context (
  auth_user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL DEFAULT 'ORNEXA',
  portal_type TEXT,
  membership_id UUID REFERENCES public.tenant_memberships(id) ON DELETE SET NULL,
  branch_id TEXT,
  set_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  set_by UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.user_preferences (
  auth_user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_active_organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  last_active_product_id TEXT DEFAULT 'ORNEXA',
  last_active_portal_type TEXT,
  preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Platform SMS provider config (disabled by default — no fake sends)
CREATE TABLE IF NOT EXISTS public.platform_sms_config (
  id TEXT PRIMARY KEY DEFAULT 'default',
  enabled BOOLEAN NOT NULL DEFAULT false,
  provider TEXT,
  sender_id TEXT,
  otp_enabled BOOLEAN NOT NULL DEFAULT false,
  transactional_enabled BOOLEAN NOT NULL DEFAULT false,
  credentials_status TEXT NOT NULL DEFAULT 'not_configured'
    CHECK (credentials_status IN ('not_configured', 'configured', 'invalid', 'disabled')),
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.platform_sms_config (id, enabled, provider, credentials_status)
VALUES ('default', false, NULL, 'not_configured')
ON CONFLICT (id) DO NOTHING;

-- OTP channel policy (platform defaults)
CREATE TABLE IF NOT EXISTS public.platform_otp_policy (
  id TEXT PRIMARY KEY DEFAULT 'default',
  preferred_channels TEXT[] NOT NULL DEFAULT ARRAY['email', 'whatsapp', 'sms'],
  fallback_enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.platform_otp_policy (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;

-- Backfill internal memberships from user_profiles
INSERT INTO public.tenant_memberships (
  auth_user_id, organization_id, product_id, membership_kind, portal_type, role, status,
  user_profile_id, branch_ids, joined_at
)
SELECT
  up.auth_id,
  up.firm_id,
  'ORNEXA',
  CASE
    WHEN lower(coalesce(up.role, '')) IN (
      'customer', 'viewer', 'customer portal', 'customer_portal',
      'supplier', 'vendor', 'karigar', 'worker'
    ) THEN 'portal'
    ELSE 'internal'
  END,
  CASE
    WHEN lower(coalesce(up.role, '')) IN ('supplier', 'vendor') THEN 'supplier'
    WHEN lower(coalesce(up.role, '')) IN ('karigar', 'worker') THEN 'karigar'
    WHEN lower(coalesce(up.role, '')) IN ('customer', 'viewer', 'customer portal', 'customer_portal') THEN 'customer'
    WHEN lower(coalesce(up.role, '')) = 'ceo' THEN 'ceo'
    ELSE NULL
  END,
  up.role,
  CASE WHEN up.active AND up.status = 'active' THEN 'active' ELSE 'suspended' END,
  up.id,
  CASE WHEN up.branch_id IS NOT NULL THEN ARRAY[up.branch_id] ELSE NULL END,
  up.created_at
FROM public.user_profiles up
WHERE up.auth_id IS NOT NULL AND up.firm_id IS NOT NULL
ON CONFLICT (auth_user_id, organization_id, product_id, membership_kind, portal_type_key)
DO UPDATE SET
  role = EXCLUDED.role,
  status = EXCLUDED.status,
  user_profile_id = EXCLUDED.user_profile_id,
  updated_at = now();

-- Backfill portal memberships from portal_identities
INSERT INTO public.tenant_memberships (
  auth_user_id, organization_id, product_id, membership_kind, portal_type, status,
  portal_identity_id, user_profile_id, branch_ids, joined_at
)
SELECT
  pi.auth_user_id,
  pi.firm_id,
  'ORNEXA',
  'portal',
  pi.portal_type,
  CASE WHEN pi.status = 'active' THEN 'active' ELSE 'suspended' END,
  pi.id,
  pi.user_profile_id,
  CASE WHEN pi.branch_id IS NOT NULL THEN ARRAY[pi.branch_id] ELSE NULL END,
  pi.created_at
FROM public.portal_identities pi
ON CONFLICT (auth_user_id, organization_id, product_id, membership_kind, portal_type_key)
DO UPDATE SET
  portal_identity_id = EXCLUDED.portal_identity_id,
  status = EXCLUDED.status,
  updated_at = now();

-- Seed active context from existing single-profile users
INSERT INTO public.identity_active_context (auth_user_id, organization_id, product_id, portal_type, branch_id)
SELECT DISTINCT ON (up.auth_id)
  up.auth_id,
  up.firm_id,
  'ORNEXA',
  CASE
    WHEN lower(coalesce(up.role, '')) IN ('supplier', 'vendor') THEN 'supplier'
    WHEN lower(coalesce(up.role, '')) IN ('karigar', 'worker') THEN 'karigar'
    WHEN lower(coalesce(up.role, '')) IN ('customer', 'viewer', 'customer portal', 'customer_portal') THEN 'customer'
    ELSE NULL
  END,
  up.branch_id
FROM public.user_profiles up
WHERE up.auth_id IS NOT NULL AND up.firm_id IS NOT NULL AND up.active AND up.status = 'active'
ORDER BY up.auth_id, up.updated_at DESC
ON CONFLICT (auth_user_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- PART 3: Active firm resolution (server-authoritative)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.my_active_firm_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_ctx UUID;
  v_fallback UUID;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  IF public.is_saas_admin() THEN RETURN NULL; END IF;

  SELECT iac.organization_id INTO v_ctx
  FROM public.identity_active_context iac
  WHERE iac.auth_user_id = auth.uid();

  IF v_ctx IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.tenant_memberships tm
    WHERE tm.auth_user_id = auth.uid()
      AND tm.organization_id = v_ctx
      AND tm.status = 'active'
  ) THEN
    RETURN v_ctx;
  END IF;

  SELECT tm.organization_id INTO v_fallback
  FROM public.tenant_memberships tm
  WHERE tm.auth_user_id = auth.uid() AND tm.status = 'active'
  ORDER BY tm.last_active_at DESC NULLS LAST, tm.joined_at DESC
  LIMIT 1;

  IF v_fallback IS NOT NULL THEN
    INSERT INTO public.identity_active_context (auth_user_id, organization_id, product_id)
    VALUES (auth.uid(), v_fallback, 'ORNEXA')
    ON CONFLICT (auth_user_id) DO UPDATE
      SET organization_id = EXCLUDED.organization_id, set_at = now();
  END IF;

  RETURN v_fallback;
END;
$$;

CREATE OR REPLACE FUNCTION public.my_firm_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT public.my_active_firm_id();
$$;

-- ---------------------------------------------------------------------------
-- PART 4: Membership listing + active context switch
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_my_memberships(
  p_product_id TEXT DEFAULT 'ORNEXA',
  p_portal_type TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_active UUID;
BEGIN
  IF auth.uid() IS NULL THEN RETURN '[]'::jsonb; END IF;

  SELECT organization_id INTO v_active
  FROM public.identity_active_context WHERE auth_user_id = auth.uid();

  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'membership_id', tm.id,
      'organization_id', tm.organization_id,
      'organization_name', o.name,
      'organization_slug', o.slug,
      'product_id', tm.product_id,
      'membership_kind', tm.membership_kind,
      'portal_type', tm.portal_type,
      'role', tm.role,
      'status', tm.status,
      'branch_ids', tm.branch_ids,
      'is_active', tm.organization_id = v_active,
      'subscription_status', os.status,
      'trial_ends_at', os.trial_ends_at,
      'renews_at', os.renews_at
    ) ORDER BY o.name)
    FROM public.tenant_memberships tm
    JOIN public.organizations o ON o.id = tm.organization_id
    LEFT JOIN public.organization_subscriptions os ON os.organization_id = tm.organization_id
    WHERE tm.auth_user_id = auth.uid()
      AND tm.status = 'active'
      AND (p_product_id IS NULL OR tm.product_id = p_product_id)
      AND (p_portal_type IS NULL OR tm.portal_type = p_portal_type OR tm.membership_kind = 'internal')
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_active_tenant_context(
  p_organization_id UUID,
  p_product_id TEXT DEFAULT 'ORNEXA',
  p_portal_type TEXT DEFAULT NULL,
  p_branch_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_membership public.tenant_memberships;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_membership
  FROM public.tenant_memberships tm
  WHERE tm.auth_user_id = auth.uid()
    AND tm.organization_id = p_organization_id
    AND tm.product_id = COALESCE(p_product_id, 'ORNEXA')
    AND tm.status = 'active'
    AND (
      p_portal_type IS NULL
      OR tm.portal_type = p_portal_type
      OR tm.membership_kind = 'internal'
    )
  ORDER BY CASE WHEN tm.portal_type = p_portal_type THEN 0 ELSE 1 END
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No authorized membership for this business' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.identity_active_context (
    auth_user_id, organization_id, product_id, portal_type, membership_id, branch_id, set_by
  ) VALUES (
    auth.uid(), p_organization_id, COALESCE(p_product_id, 'ORNEXA'),
    COALESCE(p_portal_type, v_membership.portal_type), v_membership.id, p_branch_id, auth.uid()
  )
  ON CONFLICT (auth_user_id) DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    product_id = EXCLUDED.product_id,
    portal_type = EXCLUDED.portal_type,
    membership_id = EXCLUDED.membership_id,
    branch_id = EXCLUDED.branch_id,
    set_at = now(),
    set_by = auth.uid();

  UPDATE public.tenant_memberships
  SET last_active_at = now(), updated_at = now()
  WHERE id = v_membership.id;

  INSERT INTO public.user_preferences (auth_user_id, last_active_organization_id, last_active_product_id, last_active_portal_type, updated_at)
  VALUES (auth.uid(), p_organization_id, COALESCE(p_product_id, 'ORNEXA'), p_portal_type, now())
  ON CONFLICT (auth_user_id) DO UPDATE SET
    last_active_organization_id = EXCLUDED.last_active_organization_id,
    last_active_product_id = EXCLUDED.last_active_product_id,
    last_active_portal_type = EXCLUDED.last_active_portal_type,
    updated_at = now();

  RETURN jsonb_build_object(
    'organization_id', p_organization_id,
    'product_id', COALESCE(p_product_id, 'ORNEXA'),
    'portal_type', COALESCE(p_portal_type, v_membership.portal_type),
    'membership_id', v_membership.id,
    'role', v_membership.role
  );
END;
$$;

-- Update portal context to respect active tenant
CREATE OR REPLACE FUNCTION public.get_my_portal_context(p_portal_type TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_identity public.portal_identities;
  v_parties JSONB;
  v_active_firm UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  v_active_firm := public.my_active_firm_id();

  SELECT * INTO v_identity
  FROM public.portal_identities pi
  WHERE pi.auth_user_id = auth.uid()
    AND pi.status = 'active'
    AND (v_active_firm IS NULL OR pi.firm_id = v_active_firm)
    AND (p_portal_type IS NULL OR pi.portal_type = lower(p_portal_type))
  ORDER BY CASE WHEN pi.firm_id = v_active_firm THEN 0 ELSE 1 END, pi.updated_at DESC
  LIMIT 1;

  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'party_id', ppl.party_id,
    'link_role', ppl.link_role,
    'allowed_branch_ids', ppl.allowed_branch_ids
  ) ORDER BY CASE WHEN ppl.link_role = 'primary' THEN 0 ELSE 1 END), '[]'::jsonb)
  INTO v_parties
  FROM public.portal_party_links ppl
  WHERE ppl.portal_identity_id = v_identity.id AND ppl.is_active = true;

  RETURN jsonb_build_object(
    'identity_id', v_identity.id,
    'firm_id', v_identity.firm_id,
    'portal_type', v_identity.portal_type,
    'branch_id', v_identity.branch_id,
    'party_links', v_parties
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- PART 5: Central subscription access engine (replaces licence-key gate)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.resolve_subscription_access(
  p_organization_id UUID DEFAULT NULL,
  p_product_id TEXT DEFAULT 'ORNEXA'
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_firm_id UUID;
  v_sub public.organization_subscriptions;
  v_plan public.platform_plans;
  v_status TEXT;
  v_access TEXT;
  v_message TEXT;
  v_valid BOOLEAN := false;
  v_trial_ends_ms BIGINT;
  v_renews_ms BIGINT;
  v_days_remaining INT;
BEGIN
  IF public.is_saas_admin() THEN
    RETURN jsonb_build_object(
      'access', 'granted', 'status', 'platform_owner', 'valid', true,
      'message', 'Platform owner access.', 'edition', 'Platform', 'features', '{}'::jsonb
    );
  END IF;

  v_firm_id := COALESCE(p_organization_id, public.my_active_firm_id());
  IF v_firm_id IS NULL THEN
    RETURN jsonb_build_object(
      'access', 'denied', 'status', 'no_tenant', 'valid', false,
      'message', 'No active business context.'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.tenant_memberships tm
    WHERE tm.auth_user_id = auth.uid()
      AND tm.organization_id = v_firm_id
      AND tm.status = 'active'
  ) THEN
    RETURN jsonb_build_object(
      'access', 'denied', 'status', 'no_membership', 'valid', false,
      'message', 'You are not authorized for this business.', 'organization_id', v_firm_id
    );
  END IF;

  SELECT * INTO v_sub
  FROM public.organization_subscriptions
  WHERE organization_id = v_firm_id
  ORDER BY created_at DESC LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'access', 'denied', 'status', 'no_subscription', 'valid', false,
      'message', 'No subscription found for this business.',
      'organization_id', v_firm_id
    );
  END IF;

  SELECT * INTO v_plan FROM public.platform_plans WHERE id = v_sub.plan_id;

  v_trial_ends_ms := CASE WHEN v_sub.trial_ends_at IS NULL THEN NULL
    ELSE (extract(epoch from v_sub.trial_ends_at) * 1000)::bigint END;
  v_renews_ms := CASE WHEN v_sub.renews_at IS NULL THEN NULL
    ELSE (extract(epoch from v_sub.renews_at) * 1000)::bigint END;

  IF v_sub.status = 'trial' AND v_sub.trial_ends_at IS NOT NULL AND v_sub.trial_ends_at > now() THEN
    v_valid := true; v_status := 'TRIAL_ACTIVE'; v_access := 'granted';
    v_days_remaining := GREATEST(0, ceil(extract(epoch from (v_sub.trial_ends_at - now())) / 86400)::int);
    v_message := format('Trial active — %s day(s) remaining.', v_days_remaining);
  ELSIF v_sub.status = 'trial' AND v_sub.trial_ends_at IS NOT NULL AND v_sub.trial_ends_at <= now() + interval '3 days' AND v_sub.trial_ends_at > now() THEN
    v_valid := true; v_status := 'TRIAL_EXPIRING'; v_access := 'granted';
    v_message := 'Trial expiring soon.';
  ELSIF v_sub.status = 'trial' AND (v_sub.trial_ends_at IS NULL OR v_sub.trial_ends_at <= now()) THEN
    v_valid := false; v_status := 'TRIAL_EXPIRED'; v_access := 'subscription_required';
    v_message := 'Your trial has ended. Renew or choose a plan to continue.';
  ELSIF v_sub.status = 'active' THEN
    v_valid := true; v_status := 'ACTIVE'; v_access := 'granted';
    v_message := 'Subscription active.';
  ELSIF v_sub.status = 'grace_period' OR v_sub.status = 'past_due' THEN
    v_valid := true; v_status := upper(v_sub.status); v_access := 'granted_limited';
    v_message := 'Subscription needs attention — limited access.';
  ELSIF v_sub.status = 'payment_pending' THEN
    v_valid := false; v_status := 'PAYMENT_PENDING'; v_access := 'billing_only';
    v_message := 'Payment is pending for this business.';
  ELSIF v_sub.status = 'suspended' THEN
    v_valid := false; v_status := 'SUSPENDED'; v_access := 'denied';
    v_message := 'This business subscription is suspended.';
  ELSIF v_sub.status = 'cancelled' THEN
    v_valid := false; v_status := 'CANCELLED'; v_access := 'denied';
    v_message := 'This business subscription was cancelled.';
  ELSE
    v_valid := false; v_status := 'EXPIRED'; v_access := 'subscription_required';
    v_message := 'Your subscription needs attention.';
  END IF;

  RETURN jsonb_build_object(
    'access', v_access,
    'status', v_status,
    'valid', v_valid,
    'message', v_message,
    'organization_id', v_firm_id,
    'product_id', p_product_id,
    'trialEndsAt', v_trial_ends_ms,
    'expiry', v_renews_ms,
    'daysRemaining', v_days_remaining,
    'edition', coalesce(v_plan.edition_code, v_plan.name, 'Trial'),
    'planCode', v_plan.code,
    'planName', v_plan.name,
    'limits', public.get_organization_plan_limits(v_firm_id),
    'features', (
      SELECT coalesce(jsonb_object_agg(of.feature_key, of.enabled), '{}'::jsonb)
      FROM public.organization_features of WHERE of.organization_id = v_firm_id
    )
  );
END;
$$;

-- Point legacy entitlement RPC at subscription engine
CREATE OR REPLACE FUNCTION public.get_my_tenant_subscription_entitlement()
RETURNS JSON
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT public.resolve_subscription_access(NULL, 'ORNEXA')::json;
$$;

-- Add membership on invitation accept (existing auth user)
CREATE OR REPLACE FUNCTION public.add_tenant_membership_for_invite(
  p_auth_user_id UUID,
  p_organization_id UUID,
  p_role TEXT DEFAULT NULL,
  p_portal_type TEXT DEFAULT NULL,
  p_user_profile_id UUID DEFAULT NULL,
  p_portal_identity_id UUID DEFAULT NULL,
  p_branch_id TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_id UUID;
  v_kind TEXT;
BEGIN
  v_kind := CASE WHEN p_portal_type IS NOT NULL THEN 'portal' ELSE 'internal' END;

  INSERT INTO public.tenant_memberships (
    auth_user_id, organization_id, product_id, membership_kind, portal_type, role, status,
    user_profile_id, portal_identity_id, branch_ids
  ) VALUES (
    p_auth_user_id, p_organization_id, 'ORNEXA', v_kind, p_portal_type, p_role, 'active',
    p_user_profile_id, p_portal_identity_id,
    CASE WHEN p_branch_id IS NOT NULL THEN ARRAY[p_branch_id] ELSE NULL END
  )
  ON CONFLICT (auth_user_id, organization_id, product_id, membership_kind, portal_type_key)
  DO UPDATE SET
    role = COALESCE(EXCLUDED.role, tenant_memberships.role),
    status = 'active',
    user_profile_id = COALESCE(EXCLUDED.user_profile_id, tenant_memberships.user_profile_id),
    portal_identity_id = COALESCE(EXCLUDED.portal_identity_id, tenant_memberships.portal_identity_id),
    updated_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- RLS
ALTER TABLE public.tenant_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.identity_active_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_memberships_self_read ON public.tenant_memberships
  FOR SELECT TO authenticated USING (auth_user_id = auth.uid() OR public.is_saas_admin());

CREATE POLICY identity_active_context_self ON public.identity_active_context
  FOR ALL TO authenticated USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY user_preferences_self ON public.user_preferences
  FOR ALL TO authenticated USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

REVOKE ALL ON FUNCTION public.my_active_firm_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_memberships(TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_active_tenant_context(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.resolve_subscription_access(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.add_tenant_membership_for_invite(UUID, UUID, TEXT, TEXT, UUID, UUID, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.my_active_firm_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_memberships(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_active_tenant_context(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_subscription_access(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_tenant_membership_for_invite(UUID, UUID, TEXT, TEXT, UUID, UUID, TEXT) TO service_role;

COMMIT;
