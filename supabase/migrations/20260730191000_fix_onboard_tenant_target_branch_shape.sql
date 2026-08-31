-- Target reconciliation: the existing branches table uses short_name and
-- does not have the legacy code/manager_name/is_default columns.
CREATE OR REPLACE FUNCTION public.onboard_tenant(
  p_auth_id uuid,
  p_firm_name text,
  p_firm_slug text,
  p_owner_full_name text,
  p_branch_name text DEFAULT 'Main Branch',
  p_branch_code text DEFAULT 'MAIN',
  p_branch_address text DEFAULT '',
  p_branch_phone text DEFAULT '',
  p_plan_code text DEFAULT 'trial-6mo',
  p_trial_months integer DEFAULT 6
)
RETURNS TABLE (organization_id uuid, branch_id text, subscription_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_branch_id text;
  v_plan_id uuid;
  v_sub_id uuid;
BEGIN
  IF p_auth_id IS NULL OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_auth_id) THEN
    RAISE EXCEPTION 'onboard_tenant: valid auth user is required';
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_profiles WHERE auth_id = p_auth_id) THEN
    RAISE EXCEPTION 'onboard_tenant: user already has a profile';
  END IF;
  IF nullif(trim(p_firm_name), '') IS NULL OR nullif(trim(p_firm_slug), '') IS NULL THEN
    RAISE EXCEPTION 'onboard_tenant: firm name and slug are required';
  END IF;
  SELECT id INTO v_plan_id FROM public.platform_plans WHERE code = p_plan_code AND is_active;
  IF v_plan_id IS NULL THEN RAISE EXCEPTION 'onboard_tenant: no active plan with code %', p_plan_code; END IF;

  INSERT INTO public.organizations (slug, name, license_type, is_active, data)
  VALUES (p_firm_slug, p_firm_name, 'trial', true, '{}'::jsonb)
  RETURNING id INTO v_org_id;

  v_branch_id := 'br_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
  INSERT INTO public.branches (id, firm_id, name, short_name, branch_type, phone, address, active, data)
  VALUES (v_branch_id, v_org_id, p_branch_name, p_branch_code, 'main', p_branch_phone, p_branch_address, true,
          jsonb_build_object('code', p_branch_code, 'is_default', true, 'manager_name', p_owner_full_name));

  INSERT INTO public.user_profiles (id, auth_id, firm_id, branch_id, full_name, status, active, role, data, permissions)
  VALUES (gen_random_uuid(), p_auth_id, v_org_id, v_branch_id, p_owner_full_name, 'active', true, 'Owner', '{}'::jsonb, '{}'::jsonb);
  INSERT INTO public.user_roles (user_id, role) VALUES (p_auth_id, 'owner'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  INSERT INTO public.organization_subscriptions (organization_id, plan_id, status, trial_started_at, trial_ends_at)
  VALUES (v_org_id, v_plan_id, 'trial', now(), now() + make_interval(months => p_trial_months)) RETURNING id INTO v_sub_id;
  INSERT INTO public.subscription_history (organization_id, subscription_id, action, after_value, actor_id, reason)
  VALUES (v_org_id, v_sub_id, 'trial_started', jsonb_build_object('plan_code', p_plan_code, 'trial_months', p_trial_months), p_auth_id, 'Initial tenant onboarding');
  RETURN QUERY SELECT v_org_id, v_branch_id, v_sub_id;
END;
$$;

REVOKE ALL ON FUNCTION public.onboard_tenant(uuid,text,text,text,text,text,text,text,text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.onboard_tenant(uuid,text,text,text,text,text,text,text,text,integer) TO service_role;
