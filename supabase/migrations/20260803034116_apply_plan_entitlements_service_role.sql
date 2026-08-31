-- Reconciled from production (project dqgrrafuoxaorvyrcuuh) on 2026-08-11 — this migration was applied directly to Supabase and had no local file until now.

create or replace function public.apply_plan_entitlements(
  p_organization_id uuid,
  p_plan_id uuid,
  p_reason text default 'Plan entitlements applied'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan public.platform_plans;
  v_feature record;
  v_fl_key text;
  v_fl_val jsonb;
  v_applied integer := 0;
  v_disabled integer := 0;
  v_preserved integer := 0;
  v_integration_keys text[] := array['api_access', 'karigar_portal', 'export'];
begin
  if not (
    public.is_saas_admin()
    or coalesce(auth.jwt() ->> 'role', '') = 'service_role'
    or current_user in ('postgres', 'supabase_admin')
  ) then
    raise exception 'platform admin role required' using errcode = '42501';
  end if;

  select * into v_plan from public.platform_plans where id = p_plan_id;
  if not found then
    raise exception 'plan not found' using errcode = 'P0002';
  end if;

  for v_feature in
    select pf.feature_key, pf.enabled
    from public.plan_features pf
    where pf.plan_id = p_plan_id
  loop
    if not public.is_valid_feature_key(v_feature.feature_key) then
      continue;
    end if;
    if exists (
      select 1 from public.organization_features of
      where of.organization_id = p_organization_id
        and of.feature_key = v_feature.feature_key
        and of.source = 'manual'
    ) then
      v_preserved := v_preserved + 1;
      continue;
    end if;
    insert into public.organization_features (organization_id, feature_key, enabled, source)
    values (p_organization_id, v_feature.feature_key, v_feature.enabled, 'plan')
    on conflict (organization_id, feature_key) do update
      set enabled = excluded.enabled,
          source = case when public.organization_features.source = 'manual' then 'manual' else 'plan' end,
          updated_at = now()
    where public.organization_features.source <> 'manual';
    v_applied := v_applied + 1;
  end loop;

  update public.organization_features of
  set enabled = false, updated_at = now()
  where of.organization_id = p_organization_id
    and of.source = 'plan'
    and of.feature_key not in (select pf.feature_key from public.plan_features pf where pf.plan_id = p_plan_id);
  get diagnostics v_disabled = row_count;

  foreach v_fl_key in array v_integration_keys loop
    v_fl_val := v_plan.feature_limits -> v_fl_key;
    if v_fl_val is null then continue; end if;
    if exists (select 1 from public.organization_features of where of.organization_id = p_organization_id and of.feature_key = v_fl_key and of.source = 'manual') then
      v_preserved := v_preserved + 1; continue;
    end if;
    insert into public.organization_features (organization_id, feature_key, enabled, source)
    values (p_organization_id, v_fl_key, case when jsonb_typeof(v_fl_val) = 'boolean' then (v_fl_val #>> '{}')::boolean else false end, 'plan')
    on conflict (organization_id, feature_key) do update
      set enabled = excluded.enabled, source = case when public.organization_features.source = 'manual' then 'manual' else 'plan' end, updated_at = now()
    where public.organization_features.source <> 'manual';
  end loop;

  foreach v_fl_key in array array['whatsapp', 'email', 'customer_portal', 'reports'] loop
    v_fl_val := v_plan.feature_limits -> v_fl_key;
    if v_fl_val is null or jsonb_typeof(v_fl_val) <> 'boolean' then continue; end if;
    if exists (select 1 from public.organization_features of where of.organization_id = p_organization_id and of.feature_key = v_fl_key and of.source = 'manual') then continue; end if;
    insert into public.organization_features (organization_id, feature_key, enabled, source)
    values (p_organization_id, v_fl_key, (v_fl_val #>> '{}')::boolean, 'plan')
    on conflict (organization_id, feature_key) do update set enabled = excluded.enabled, source = 'plan', updated_at = now()
    where public.organization_features.source <> 'manual';
  end loop;

  if public.is_saas_admin() then
    perform public.record_platform_audit('entitlements.applied', p_organization_id, 'plan', p_plan_id::text, coalesce(nullif(trim(p_reason), ''), 'Plan entitlements applied'), null,
      jsonb_build_object('plan_id', p_plan_id, 'plan_code', v_plan.code, 'applied', v_applied, 'disabled', v_disabled, 'manual_preserved', v_preserved));
  end if;

  return jsonb_build_object('applied', v_applied, 'disabled', v_disabled, 'manual_preserved', v_preserved);
end;
$$;
