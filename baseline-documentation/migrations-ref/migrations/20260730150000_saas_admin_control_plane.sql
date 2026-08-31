-- MTJ ERP SaaS control plane.
-- Platform records are deliberately separate from company ERP data.

CREATE TABLE IF NOT EXISTS public.platform_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  billing_cycle text NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly','quarterly','yearly','custom')),
  price_minor bigint NOT NULL DEFAULT 0 CHECK (price_minor >= 0),
  branch_limit integer CHECK (branch_limit IS NULL OR branch_limit > 0),
  user_limit integer CHECK (user_limit IS NULL OR user_limit > 0),
  storage_limit_bytes bigint CHECK (storage_limit_bytes IS NULL OR storage_limit_bytes >= 0),
  feature_limits jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.organization_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  plan_id uuid NOT NULL REFERENCES public.platform_plans(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'trial' CHECK (status IN ('trial','active','past_due','suspended','cancelled','expired')),
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  starts_at timestamptz,
  renews_at timestamptz,
  suspended_at timestamptz,
  billing_cycle text,
  manual_payment_reference text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id)
);

CREATE TABLE IF NOT EXISTS public.organization_features (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('plan','manual','system')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, feature_key)
);

CREATE TABLE IF NOT EXISTS public.platform_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  target_type text,
  target_id text,
  reason text,
  before_value jsonb,
  after_value jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.support_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  reason text NOT NULL CHECK (length(trim(reason)) >= 10),
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > starts_at)
);

ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS onboarding jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.subscription_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  subscription_id uuid REFERENCES public.organization_subscriptions(id) ON DELETE SET NULL,
  action text NOT NULL,
  before_value jsonb,
  after_value jsonb,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.organization_usage_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_count integer NOT NULL DEFAULT 0,
  branch_count integer NOT NULL DEFAULT 0,
  storage_bytes bigint NOT NULL DEFAULT 0,
  captured_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.is_saas_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role((select auth.uid()), 'saas_admin'::public.app_role);
$$;
REVOKE ALL ON FUNCTION public.is_saas_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_saas_admin() TO authenticated;

-- Platform operators may manage tenant metadata and branches. This does not
-- grant them company business-data access; those tables retain their own RLS.
DROP POLICY IF EXISTS organizations_platform_admin_manage ON public.organizations;
CREATE POLICY organizations_platform_admin_manage ON public.organizations FOR ALL TO authenticated
  USING (public.is_saas_admin()) WITH CHECK (public.is_saas_admin());

DROP POLICY IF EXISTS branches_platform_admin_manage ON public.branches;
CREATE POLICY branches_platform_admin_manage ON public.branches FOR ALL TO authenticated
  USING (public.is_saas_admin()) WITH CHECK (public.is_saas_admin());

DROP POLICY IF EXISTS user_profiles_platform_admin_manage ON public.user_profiles;
CREATE POLICY user_profiles_platform_admin_manage ON public.user_profiles FOR ALL TO authenticated
  USING (public.is_saas_admin()) WITH CHECK (public.is_saas_admin());

DROP POLICY IF EXISTS user_roles_platform_admin_manage ON public.user_roles;
CREATE POLICY user_roles_platform_admin_manage ON public.user_roles FOR ALL TO authenticated
  USING (public.is_saas_admin()) WITH CHECK (public.is_saas_admin());

ALTER TABLE public.platform_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_usage_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_plans_platform_admin ON public.platform_plans;
CREATE POLICY platform_plans_platform_admin ON public.platform_plans FOR ALL TO authenticated
  USING (public.is_saas_admin()) WITH CHECK (public.is_saas_admin());

DROP POLICY IF EXISTS organization_subscriptions_platform_admin ON public.organization_subscriptions;
CREATE POLICY organization_subscriptions_platform_admin ON public.organization_subscriptions FOR ALL TO authenticated
  USING (public.is_saas_admin()) WITH CHECK (public.is_saas_admin());
DROP POLICY IF EXISTS organization_subscriptions_company_read ON public.organization_subscriptions;
CREATE POLICY organization_subscriptions_company_read ON public.organization_subscriptions FOR SELECT TO authenticated
  USING (organization_id = public.my_firm_id());

DROP POLICY IF EXISTS organization_features_platform_admin ON public.organization_features;
CREATE POLICY organization_features_platform_admin ON public.organization_features FOR ALL TO authenticated
  USING (public.is_saas_admin()) WITH CHECK (public.is_saas_admin());
DROP POLICY IF EXISTS organization_features_company_read ON public.organization_features;
CREATE POLICY organization_features_company_read ON public.organization_features FOR SELECT TO authenticated
  USING (organization_id = public.my_firm_id());

DROP POLICY IF EXISTS platform_audit_events_platform_admin ON public.platform_audit_events;
CREATE POLICY platform_audit_events_platform_admin ON public.platform_audit_events FOR SELECT TO authenticated
  USING (public.is_saas_admin());
DROP POLICY IF EXISTS platform_audit_events_insert_actor ON public.platform_audit_events;
CREATE POLICY platform_audit_events_insert_actor ON public.platform_audit_events FOR INSERT TO authenticated
  WITH CHECK (public.is_saas_admin() AND actor_id = (select auth.uid()));

DROP POLICY IF EXISTS support_sessions_platform_admin ON public.support_sessions;
CREATE POLICY support_sessions_platform_admin ON public.support_sessions FOR ALL TO authenticated
  USING (public.is_saas_admin() AND actor_id = (select auth.uid()))
  WITH CHECK (public.is_saas_admin() AND actor_id = (select auth.uid()));

CREATE POLICY subscription_history_platform_read ON public.subscription_history FOR SELECT TO authenticated
  USING (public.is_saas_admin());
CREATE POLICY subscription_history_platform_insert ON public.subscription_history FOR INSERT TO authenticated
  WITH CHECK (public.is_saas_admin() AND actor_id = (select auth.uid()));
CREATE POLICY platform_settings_platform_admin ON public.platform_settings FOR ALL TO authenticated
  USING (public.is_saas_admin()) WITH CHECK (public.is_saas_admin() AND updated_by = (select auth.uid()));
CREATE POLICY organization_usage_platform_admin ON public.organization_usage_snapshots FOR SELECT TO authenticated
  USING (public.is_saas_admin());
CREATE POLICY organization_usage_company_read ON public.organization_usage_snapshots FOR SELECT TO authenticated
  USING (organization_id = public.my_firm_id());

GRANT SELECT, INSERT, UPDATE ON public.platform_plans TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.organization_subscriptions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.organization_features TO authenticated;
GRANT SELECT, INSERT ON public.platform_audit_events TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.support_sessions TO authenticated;
GRANT SELECT, INSERT ON public.subscription_history TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.platform_settings TO authenticated;
GRANT SELECT ON public.organization_usage_snapshots TO authenticated;

CREATE OR REPLACE FUNCTION public.organization_feature_enabled(p_feature_key text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((
    SELECT of.enabled
    FROM public.organization_features of
    WHERE of.organization_id = public.my_firm_id()
      AND of.feature_key = p_feature_key
  ), false);
$$;
REVOKE ALL ON FUNCTION public.organization_feature_enabled(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.organization_feature_enabled(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_platform_audit(
  p_action text,
  p_organization_id uuid DEFAULT NULL,
  p_target_type text DEFAULT NULL,
  p_target_id text DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_before jsonb DEFAULT NULL,
  p_after jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.is_saas_admin() THEN RAISE EXCEPTION 'platform admin role required'; END IF;
  INSERT INTO public.platform_audit_events(actor_id, action, organization_id, target_type, target_id, reason, before_value, after_value)
  VALUES ((select auth.uid()), p_action, p_organization_id, p_target_type, p_target_id, p_reason, p_before, p_after)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.record_platform_audit(text, uuid, text, text, text, jsonb, jsonb) TO authenticated;

CREATE INDEX IF NOT EXISTS idx_org_subscriptions_status ON public.organization_subscriptions(status, renews_at);
CREATE INDEX IF NOT EXISTS idx_platform_audit_events_created ON public.platform_audit_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_audit_events_org ON public.platform_audit_events(organization_id, created_at DESC);
