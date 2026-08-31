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

  select * into v_sub
  from public.organization_subscriptions
  where organization_id = v_firm_id;

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

create or replace function public.get_my_tenant_subscription_entitlement()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_firm_id uuid := public.my_firm_id();
  v_sub public.organization_subscriptions;
  v_plan public.platform_plans;
  v_trial_ends_ms bigint;
  v_renews_ms bigint;
  v_valid boolean := false;
  v_status text;
  v_message text;
  v_edition text;
begin
  if v_firm_id is null then
    return json_build_object('valid', false, 'message', 'No tenant profile.');
  end if;

  select * into v_sub
  from public.organization_subscriptions os
  where os.organization_id = v_firm_id
  order by os.created_at desc
  limit 1;

  if not found then
    return json_build_object('valid', false, 'message', 'No subscription for tenant.');
  end if;

  select * into v_plan from public.platform_plans where id = v_sub.plan_id;
  v_edition := coalesce(v_plan.edition_code, v_plan.name, 'Trial');

  v_trial_ends_ms := case
    when v_sub.trial_ends_at is null then null
    else (extract(epoch from v_sub.trial_ends_at) * 1000)::bigint
  end;
  v_renews_ms := case
    when v_sub.renews_at is null then null
    else (extract(epoch from v_sub.renews_at) * 1000)::bigint
  end;

  if v_sub.status = 'trial'
    and v_sub.trial_ends_at is not null
    and v_sub.trial_ends_at > now() then
    v_valid := true;
    v_status := 'trial';
    v_message := 'Trial subscription active.';
  elsif v_sub.status = 'active' then
    v_valid := true;
    v_status := 'active';
    v_message := 'Subscription active.';
  elsif v_sub.status = 'suspended' then
    v_valid := false;
    v_status := 'suspended';
    v_message := 'Subscription suspended.';
  else
    v_valid := false;
    v_status := 'expired';
    v_message := 'Subscription expired or trial ended.';
  end if;

  return json_build_object(
    'valid', v_valid,
    'status', v_status,
    'message', v_message,
    'trialEndsAt', v_trial_ends_ms,
    'expiry', v_renews_ms,
    'edition', v_edition,
    'planCode', v_plan.code,
    'limits', public.get_organization_plan_limits(v_firm_id)
  );
end;
$$;
