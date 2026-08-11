-- Reconciled from production (project dqgrrafuoxaorvyrcuuh) on 2026-08-11 — this migration was applied directly to Supabase and had no local file until now.

do $$
declare
  v_empty_commercial jsonb := jsonb_build_object(
    'license_fee_minor', null,
    'setup_fee_minor', null,
    'amc_annual_minor', null,
    'subscription', jsonb_build_object('enabled', false, 'cycle', 'monthly', 'amount_minor', null),
    'renewal_fee_minor', null,
    'upgrade_fee_minor', null,
    'addons', '[]'::jsonb,
    'trial_days', null,
    'promotional', jsonb_build_object('active', false, 'discount_percent', null, 'valid_until', null)
  );
  v_starter_id uuid;
  v_essential_id uuid;
  v_standard_id uuid;
  v_professional_id uuid;
  v_enterprise_id uuid;
  v_modules text[];
begin
  insert into public.platform_plans (
    code, name, edition_code, description, billing_cycle, price_minor,
    commercial_config, feature_limits, branch_limit, user_limit, workshop_limit, is_active
  ) values (
    'manufacturing_starter', 'Manufacturing Starter', 'manufacturing_starter',
    'Entry-level manufacturing ERP for small workshops.', 'custom', 0, v_empty_commercial,
    jsonb_build_object('api_access', false, 'whatsapp', false, 'email', false, 'customer_portal', false, 'karigar_portal', true, 'reports', true, 'export', false, 'support_tier', 'email'),
    1, 3, 1, true
  ) on conflict (code) do update set edition_code = excluded.edition_code, name = excluded.name, description = excluded.description, commercial_config = excluded.commercial_config, feature_limits = excluded.feature_limits, branch_limit = excluded.branch_limit, user_limit = excluded.user_limit, workshop_limit = excluded.workshop_limit
  returning id into v_starter_id;
  if v_starter_id is null then select id into v_starter_id from public.platform_plans where code = 'manufacturing_starter'; end if;
  v_modules := array['billing','inventory','manufacturing','attendance','hr','reports','job_work'];
  delete from public.plan_features where plan_id = v_starter_id;
  insert into public.plan_features (plan_id, feature_key, enabled) select v_starter_id, unnest(v_modules), true;

  insert into public.platform_plans (code, name, edition_code, description, billing_cycle, price_minor, commercial_config, feature_limits, branch_limit, user_limit, workshop_limit, is_active) values ('manufacturing_essential', 'Manufacturing Essential', 'manufacturing_essential', 'Core manufacturing with orders, repairs, and barcode tagging.', 'custom', 0, v_empty_commercial, jsonb_build_object('api_access', false, 'whatsapp', false, 'email', false, 'customer_portal', false, 'karigar_portal', true, 'reports', true, 'export', false, 'support_tier', 'email'), 2, 5, 2, true) on conflict (code) do update set edition_code = excluded.edition_code, name = excluded.name, description = excluded.description, commercial_config = excluded.commercial_config, feature_limits = excluded.feature_limits, branch_limit = excluded.branch_limit, user_limit = excluded.user_limit, workshop_limit = excluded.workshop_limit returning id into v_essential_id;
  if v_essential_id is null then select id into v_essential_id from public.platform_plans where code = 'manufacturing_essential'; end if;
  v_modules := array['billing','inventory','manufacturing','attendance','hr','reports','job_work','orders','repairs','barcode'];
  delete from public.plan_features where plan_id = v_essential_id;
  insert into public.plan_features (plan_id, feature_key, enabled) select v_essential_id, unnest(v_modules), true;

  insert into public.platform_plans (code, name, edition_code, description, billing_cycle, price_minor, commercial_config, feature_limits, branch_limit, user_limit, workshop_limit, is_active) values ('manufacturing_standard', 'Manufacturing Standard', 'manufacturing_standard', 'Full manufacturing with GST, metal conversion, CRM, and payroll.', 'custom', 0, v_empty_commercial, jsonb_build_object('api_access', false, 'whatsapp', true, 'email', false, 'customer_portal', false, 'karigar_portal', true, 'reports', true, 'export', true, 'support_tier', 'email'), 3, 10, 3, true) on conflict (code) do update set edition_code = excluded.edition_code, name = excluded.name, description = excluded.description, commercial_config = excluded.commercial_config, feature_limits = excluded.feature_limits, branch_limit = excluded.branch_limit, user_limit = excluded.user_limit, workshop_limit = excluded.workshop_limit returning id into v_standard_id;
  if v_standard_id is null then select id into v_standard_id from public.platform_plans where code = 'manufacturing_standard'; end if;
  v_modules := array['billing','inventory','manufacturing','attendance','hr','reports','job_work','orders','repairs','barcode','gst','melt_account','bullion','crm_communications','payroll'];
  delete from public.plan_features where plan_id = v_standard_id;
  insert into public.plan_features (plan_id, feature_key, enabled) select v_standard_id, unnest(v_modules), true;

  insert into public.platform_plans (code, name, edition_code, description, billing_cycle, price_minor, commercial_config, feature_limits, branch_limit, user_limit, workshop_limit, is_active) values ('manufacturing_professional', 'Manufacturing Professional', 'manufacturing_professional', 'Multi-branch manufacturing with communications, analytics, and supplier management.', 'custom', 0, v_empty_commercial, jsonb_build_object('api_access', true, 'whatsapp', true, 'email', true, 'customer_portal', true, 'karigar_portal', true, 'reports', true, 'export', true, 'support_tier', 'priority'), 5, 25, 5, true) on conflict (code) do update set edition_code = excluded.edition_code, name = excluded.name, description = excluded.description, commercial_config = excluded.commercial_config, feature_limits = excluded.feature_limits, branch_limit = excluded.branch_limit, user_limit = excluded.user_limit, workshop_limit = excluded.workshop_limit returning id into v_professional_id;
  if v_professional_id is null then select id into v_professional_id from public.platform_plans where code = 'manufacturing_professional'; end if;
  v_modules := array['billing','inventory','manufacturing','attendance','hr','reports','job_work','orders','repairs','barcode','gst','melt_account','bullion','crm_communications','payroll','whatsapp','email','sms','supplier_management','analytics','multi_branch','loyalty_program'];
  delete from public.plan_features where plan_id = v_professional_id;
  insert into public.plan_features (plan_id, feature_key, enabled) select v_professional_id, unnest(v_modules), true;

  insert into public.platform_plans (code, name, edition_code, description, billing_cycle, price_minor, commercial_config, feature_limits, branch_limit, user_limit, workshop_limit, is_active) values ('manufacturing_enterprise', 'Manufacturing Enterprise', 'manufacturing_enterprise', 'Full platform access with API, portals, hardware integration, and dedicated support.', 'custom', 0, v_empty_commercial, jsonb_build_object('api_access', true, 'whatsapp', true, 'email', true, 'customer_portal', true, 'karigar_portal', true, 'reports', true, 'export', true, 'support_tier', 'dedicated'), null, null, null, true) on conflict (code) do update set edition_code = excluded.edition_code, name = excluded.name, description = excluded.description, commercial_config = excluded.commercial_config, feature_limits = excluded.feature_limits, branch_limit = excluded.branch_limit, user_limit = excluded.user_limit, workshop_limit = excluded.workshop_limit returning id into v_enterprise_id;
  if v_enterprise_id is null then select id into v_enterprise_id from public.platform_plans where code = 'manufacturing_enterprise'; end if;
  v_modules := array['billing','manufacturing','job_work','gst','bullion','melt_account','crm_communications','inventory','repairs','orders','attendance','payroll','hr','loyalty_program','barcode','hardware_integration','whatsapp','email','sms','customer_portal','supplier_management','reports','analytics','multi_branch'];
  delete from public.plan_features where plan_id = v_enterprise_id;
  insert into public.plan_features (plan_id, feature_key, enabled) select v_enterprise_id, unnest(v_modules), true;

  update public.platform_plans set edition_code = coalesce(edition_code, 'pilot'), commercial_config = case when commercial_config = '{}'::jsonb then v_empty_commercial else commercial_config end where code = 'trial-6mo';
end $$;
