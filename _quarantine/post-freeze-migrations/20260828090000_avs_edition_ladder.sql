-- AVS Owner commercial ladder: ₹10k / ₹30k / ₹50k + MTG (2026-08-28)
-- Retire legacy 15k/20k assignable defaults; deactivate old manufacturing_starter ladder for new trials.

do $$
declare
  v_empty_commercial jsonb := jsonb_build_object(
    'license_fee_minor', null,
    'setup_fee_minor', null,
    'amc_annual_minor', null,
    'subscription', jsonb_build_object('enabled', true, 'cycle', 'yearly', 'amount_minor', null),
    'renewal_fee_minor', null,
    'upgrade_fee_minor', null,
    'addons', '[]'::jsonb,
    'trial_days', 14,
    'promotional', jsonb_build_object('active', false, 'discount_percent', null, 'valid_until', null)
  );
  v_10k uuid;
  v_30k uuid;
  v_50k uuid;
  v_mtg uuid;
  v_modules text[];
begin
  update public.platform_plans
  set is_active = false
  where code in (
    'manufacturing_starter',
    'manufacturing_essential',
    'manufacturing_standard',
    'manufacturing_professional',
    'manufacturing_enterprise'
  )
  and code not like 'avs_%';

  insert into public.platform_plans (
    code, name, edition_code, description, billing_cycle, price_minor,
    commercial_config, feature_limits, branch_limit, user_limit, workshop_limit, is_active
  ) values (
    'avs_manufacturing_10k', 'AVS Manufacturing · ₹10k', 'avs_10k',
    'Entry manufacturing ERP — stock, orders, workshop, ledger, basic billing.', 'yearly', 1000000,
    v_empty_commercial,
    jsonb_build_object('api_access', false, 'whatsapp', false, 'customer_portal', false, 'karigar_portal', true, 'item_masters', false),
    1, 3, 1, true
  ) on conflict (code) do update set
    name = excluded.name, edition_code = excluded.edition_code, price_minor = excluded.price_minor,
    description = excluded.description, is_active = true
  returning id into v_10k;
  if v_10k is null then select id into v_10k from public.platform_plans where code = 'avs_manufacturing_10k'; end if;
  v_modules := array['billing','inventory','manufacturing','orders','workshop','ledger','reports'];
  delete from public.plan_features where plan_id = v_10k;
  insert into public.plan_features (plan_id, feature_key, enabled) select v_10k, unnest(v_modules), true;

  insert into public.platform_plans (
    code, name, edition_code, description, billing_cycle, price_minor,
    commercial_config, feature_limits, branch_limit, user_limit, workshop_limit, is_active
  ) values (
    'avs_manufacturing_30k', 'AVS Manufacturing · ₹30k', 'avs_30k',
    'Standard manufacturing — GST, conversions, CRM, payroll, barcode.', 'yearly', 3000000,
    v_empty_commercial,
    jsonb_build_object('api_access', false, 'whatsapp', true, 'customer_portal', true, 'karigar_portal', true, 'item_masters', true),
    2, 10, 2, true
  ) on conflict (code) do update set
    name = excluded.name, edition_code = excluded.edition_code, price_minor = excluded.price_minor,
    description = excluded.description, is_active = true
  returning id into v_30k;
  if v_30k is null then select id into v_30k from public.platform_plans where code = 'avs_manufacturing_30k'; end if;
  v_modules := array['billing','inventory','manufacturing','orders','workshop','ledger','reports','gst','barcode','crm_communications','payroll','item_masters'];
  delete from public.plan_features where plan_id = v_30k;
  insert into public.plan_features (plan_id, feature_key, enabled) select v_30k, unnest(v_modules), true;

  insert into public.platform_plans (
    code, name, edition_code, description, billing_cycle, price_minor,
    commercial_config, feature_limits, branch_limit, user_limit, workshop_limit, is_active
  ) values (
    'avs_manufacturing_50k', 'AVS Manufacturing · ₹50k', 'avs_50k',
    'Professional manufacturing — multi-branch, analytics, supplier, full portals.', 'yearly', 5000000,
    v_empty_commercial,
    jsonb_build_object('api_access', true, 'whatsapp', true, 'customer_portal', true, 'karigar_portal', true, 'item_masters', true),
    3, 25, 3, true
  ) on conflict (code) do update set
    name = excluded.name, edition_code = excluded.edition_code, price_minor = excluded.price_minor,
    description = excluded.description, is_active = true
  returning id into v_50k;
  if v_50k is null then select id into v_50k from public.platform_plans where code = 'avs_manufacturing_50k'; end if;
  v_modules := array['billing','inventory','manufacturing','orders','workshop','ledger','reports','gst','barcode','crm_communications','payroll','analytics','multi_branch','supplier_management','item_masters'];
  delete from public.plan_features where plan_id = v_50k;
  insert into public.plan_features (plan_id, feature_key, enabled) select v_50k, unnest(v_modules), true;

  insert into public.platform_plans (
    code, name, edition_code, description, billing_cycle, price_minor,
    commercial_config, feature_limits, branch_limit, user_limit, workshop_limit, is_active
  ) values (
    'avs_mtg', 'AVS MTG Simplified', 'avs_mtg',
    'Simplified MTG/MTJ workshop shell — stock, orders, issue/receive, settlement.', 'yearly', 1000000,
    v_empty_commercial,
    jsonb_build_object('api_access', false, 'whatsapp', false, 'customer_portal', false, 'karigar_portal', true, 'mtg_shell', true, 'manubook', false),
    1, 5, 1, true
  ) on conflict (code) do update set
    name = excluded.name, edition_code = excluded.edition_code, price_minor = excluded.price_minor,
    description = excluded.description, is_active = true
  returning id into v_mtg;
  if v_mtg is null then select id into v_mtg from public.platform_plans where code = 'avs_mtg'; end if;
  v_modules := array['billing','inventory','manufacturing','orders','workshop','ledger','reports','mtg_shell'];
  delete from public.plan_features where plan_id = v_mtg;
  insert into public.plan_features (plan_id, feature_key, enabled) select v_mtg, unnest(v_modules), true;
end $$;
