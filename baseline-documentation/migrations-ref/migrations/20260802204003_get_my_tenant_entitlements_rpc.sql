-- Reconciled from production (project dqgrrafuoxaorvyrcuuh) on 2026-08-11 — this migration was applied directly to Supabase and had no local file until now.

create or replace function public.get_my_tenant_entitlements()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_firm_id uuid := public.my_firm_id();
  v_sub public.organization_subscriptions;
  v_plan public.platform_plans;
  v_features jsonb := '{}'::jsonb;
  v_row record;
begin
  if v_firm_id is null then
    return jsonb_build_object('features', '{}'::jsonb, 'limits', '{}'::jsonb, 'plan', null, 'subscription', null);
  end if;

  for v_row in
    select of.feature_key, of.enabled
    from public.organization_features of
    where of.organization_id = v_firm_id
  loop
    v_features := v_features || jsonb_build_object(v_row.feature_key, v_row.enabled);
  end loop;

  select * into v_sub from public.organization_subscriptions where organization_id = v_firm_id;
  if found then
    select * into v_plan from public.platform_plans where id = v_sub.plan_id;
  end if;

  return jsonb_build_object(
    'features', v_features,
    'limits', public.get_organization_plan_limits(v_firm_id),
    'plan', case when v_plan.id is not null then to_jsonb(v_plan) else null end,
    'subscription', case when v_sub.organization_id is not null then jsonb_build_object(
      'status', v_sub.status,
      'trial_ends_at', v_sub.trial_ends_at,
      'renews_at', v_sub.renews_at
    ) else null end
  );
end;
$$;

revoke all on function public.get_my_tenant_entitlements() from public, anon;
grant execute on function public.get_my_tenant_entitlements() to authenticated;
