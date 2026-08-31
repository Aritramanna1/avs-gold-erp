-- Reconciled from production (project dqgrrafuoxaorvyrcuuh) on 2026-08-11 — this migration was applied directly to Supabase and had no local file until now.

-- Commercial Editions & Licensing Architecture
-- plan_features catalog, commercial_config, apply_plan_entitlements, limit enforcement.

-- ── Extend platform_plans ─────────────────────────────────────────────────────

alter table public.platform_plans
  add column if not exists edition_code text,
  add column if not exists commercial_config jsonb not null default '{}'::jsonb,
  add column if not exists workshop_limit integer check (workshop_limit is null or workshop_limit > 0);

create index if not exists idx_platform_plans_edition_code
  on public.platform_plans (edition_code) where edition_code is not null;

-- ── plan_features: edition → module mapping ─────────────────────────────────

create table if not exists public.plan_features (
  plan_id uuid not null references public.platform_plans(id) on delete cascade,
  feature_key text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (plan_id, feature_key),
  constraint plan_features_key_nonempty check (length(trim(feature_key)) > 0)
);

alter table public.plan_features enable row level security;

drop policy if exists plan_features_platform_admin on public.plan_features;
create policy plan_features_platform_admin on public.plan_features
  for all to authenticated
  using (public.is_saas_admin())
  with check (public.is_saas_admin());

grant select, insert, update, delete on public.plan_features to authenticated;

-- ── Valid feature key catalog ───────────────────────────────────────────────

create or replace function public.is_valid_feature_key(p_feature_key text)
returns boolean
language sql
immutable
as $$
  select p_feature_key = any(array[
    'billing', 'manufacturing', 'job_work', 'gst', 'bullion', 'melt_account',
    'crm_communications', 'inventory', 'repairs', 'orders', 'attendance', 'payroll',
    'hr', 'loyalty_program', 'barcode', 'hardware_integration', 'whatsapp', 'email',
    'sms', 'customer_portal', 'supplier_management', 'reports', 'analytics', 'multi_branch',
    'api_access', 'karigar_portal', 'export'
  ]);
$$;

-- ── Fail-closed feature check (active subscription requires explicit grant) ───

create or replace function public.organization_feature_enabled(p_feature_key text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_enabled boolean;
  v_sub_status text;
begin
  select of.enabled into v_enabled
  from public.organization_features of
  where of.organization_id = public.my_firm_id()
    and of.feature_key = p_feature_key;

  if found then
    return v_enabled;
  end if;

  -- No row: fail-closed when subscription is active/trial (not pilot bootstrap).
  select os.status into v_sub_status
  from public.organization_subscriptions os
  where os.organization_id = public.my_firm_id();

  if v_sub_status in ('trial', 'active', 'past_due') then
    return false;
  end if;

  -- Suspended/expired/cancelled or no subscription: fail-closed.
  return false;
end;
$$;

create or replace function public.tenant_module_write_allowed(p_feature_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_saas_admin()
    or public.organization_feature_enabled(p_feature_key);
$$;

-- ── Organization limit helpers ────────────────────────────────────────────────

create or replace function public.get_organization_plan_limits(p_organization_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org_id uuid := coalesce(p_organization_id, public.my_firm_id());
  v_plan public.platform_plans;
begin
  if v_org_id is null then
    return '{}'::jsonb;
  end if;

  select pp.* into v_plan
  from public.organization_subscriptions os
  join public.platform_plans pp on pp.id = os.plan_id
  where os.organization_id = v_org_id;

  if not found then
    return '{}'::jsonb;
  end if;

  return jsonb_build_object(
    'user_limit', v_plan.user_limit,
    'branch_limit', v_plan.branch_limit,
    'workshop_limit', v_plan.workshop_limit,
    'storage_limit_bytes', v_plan.storage_limit_bytes,
    'feature_limits', coalesce(v_plan.feature_limits, '{}'::jsonb),
    'edition_code', v_plan.edition_code,
    'plan_code', v_plan.code
  );
end;
$$;

create or replace function public.check_organization_limit(p_resource text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org_id uuid := public.my_firm_id();
  v_limits jsonb;
  v_limit integer;
  v_count integer;
begin
  if v_org_id is null then
    return true;
  end if;
  if public.is_saas_admin() then
    return true;
  end if;

  v_limits := public.get_organization_plan_limits(v_org_id);

  if p_resource = 'users' then
    v_limit := (v_limits->>'user_limit')::integer;
    if v_limit is null then return true; end if;
    select count(*)::integer into v_count
    from public.user_profiles up
    where up.firm_id = v_org_id and up.active and up.status = 'active'
      and lower(coalesce(up.role, '')) <> 'customer';
    return v_count < v_limit;
  elsif p_resource = 'branches' then
    v_limit := (v_limits->>'branch_limit')::integer;
    if v_limit is null then return true; end if;
    select count(*)::integer into v_count
    from public.branches b
    where b.firm_id = v_org_id and b.active;
    return v_count < v_limit;
  elsif p_resource = 'workshops' then
    v_limit := (v_limits->>'workshop_limit')::integer;
    if v_limit is null then return true; end if;
    select count(*)::integer into v_count
    from public.workshops w
    where w.firm_id = v_org_id;
    return v_count < v_limit;
  end if;

  return true;
end;
$$;

create or replace function public.assert_organization_limit(p_resource text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.check_organization_limit(p_resource) then
    raise exception 'plan limit exceeded for %', p_resource using errcode = '42501';
  end if;
end;
$$;

-- Triggers for limit enforcement on insert
create or replace function public.trg_enforce_branch_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_organization_limit('branches');
  return new;
end;
$$;

drop trigger if exists enforce_branch_limit on public.branches;
create trigger enforce_branch_limit
  before insert on public.branches
  for each row execute function public.trg_enforce_branch_limit();

create or replace function public.trg_enforce_user_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.active and new.status = 'active'
     and lower(coalesce(new.role, '')) <> 'customer' then
    perform public.assert_organization_limit('users');
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_user_limit on public.user_profiles;
create trigger enforce_user_limit
  before insert on public.user_profiles
  for each row execute function public.trg_enforce_user_limit();

create or replace function public.trg_enforce_workshop_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_organization_limit('workshops');
  return new;
end;
$$;

drop trigger if exists enforce_workshop_limit on public.workshops;
create trigger enforce_workshop_limit
  before insert on public.workshops
  for each row execute function public.trg_enforce_workshop_limit();

-- ── apply_plan_entitlements: sync plan → organization_features ──────────────

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
  v_integration_keys text[] := array[
    'api_access', 'karigar_portal', 'export'
  ];
begin
  if not public.is_saas_admin() then
    raise exception 'platform admin role required' using errcode = '42501';
  end if;

  select * into v_plan from public.platform_plans where id = p_plan_id;
  if not found then
    raise exception 'plan not found' using errcode = 'P0002';
  end if;

  -- Apply plan_features (modules)
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
          source = case
            when public.organization_features.source = 'manual' then 'manual'
            else 'plan'
          end,
          updated_at = now()
    where public.organization_features.source <> 'manual';

    v_applied := v_applied + 1;
  end loop;

  -- Disable plan-sourced features no longer in the plan
  update public.organization_features of
  set enabled = false, updated_at = now()
  where of.organization_id = p_organization_id
    and of.source = 'plan'
    and of.feature_key not in (
      select pf.feature_key from public.plan_features pf where pf.plan_id = p_plan_id
    );
  get diagnostics v_disabled = row_count;

  -- Sync integration toggles from feature_limits jsonb
  foreach v_fl_key in array v_integration_keys loop
    v_fl_val := v_plan.feature_limits -> v_fl_key;
    if v_fl_val is null then
      continue;
    end if;

    if exists (
      select 1 from public.organization_features of
      where of.organization_id = p_organization_id
        and of.feature_key = v_fl_key
        and of.source = 'manual'
    ) then
      v_preserved := v_preserved + 1;
      continue;
    end if;

    insert into public.organization_features (organization_id, feature_key, enabled, source)
    values (
      p_organization_id,
      v_fl_key,
      case when jsonb_typeof(v_fl_val) = 'boolean' then (v_fl_val #>> '{}')::boolean else false end,
      'plan'
    )
    on conflict (organization_id, feature_key) do update
      set enabled = excluded.enabled,
          source = case
            when public.organization_features.source = 'manual' then 'manual'
            else 'plan'
          end,
          updated_at = now()
    where public.organization_features.source <> 'manual';
  end loop;

  -- Mirror boolean module toggles from feature_limits (whatsapp, email, etc.)
  foreach v_fl_key in array array['whatsapp', 'email', 'customer_portal', 'reports'] loop
    v_fl_val := v_plan.feature_limits -> v_fl_key;
    if v_fl_val is null or jsonb_typeof(v_fl_val) <> 'boolean' then
      continue;
    end if;

    if exists (
      select 1 from public.organization_features of
      where of.organization_id = p_organization_id
        and of.feature_key = v_fl_key
        and of.source = 'manual'
    ) then
      continue;
    end if;

    insert into public.organization_features (organization_id, feature_key, enabled, source)
    values (p_organization_id, v_fl_key, (v_fl_val #>> '{}')::boolean, 'plan')
    on conflict (organization_id, feature_key) do update
      set enabled = excluded.enabled, source = 'plan', updated_at = now()
    where public.organization_features.source <> 'manual';
  end loop;

  perform public.record_platform_audit(
    'entitlements.applied',
    p_organization_id,
    'plan',
    p_plan_id::text,
    coalesce(nullif(trim(p_reason), ''), 'Plan entitlements applied'),
    null,
    jsonb_build_object(
      'plan_id', p_plan_id,
      'plan_code', v_plan.code,
      'edition_code', v_plan.edition_code,
      'applied', v_applied,
      'disabled', v_disabled,
      'manual_preserved', v_preserved
    )
  );

  return jsonb_build_object(
    'applied', v_applied,
    'disabled', v_disabled,
    'manual_preserved', v_preserved
  );
end;
$$;

revoke all on function public.apply_plan_entitlements(uuid, uuid, text) from public, anon;
grant execute on function public.apply_plan_entitlements(uuid, uuid, text) to authenticated;

revoke all on function public.get_organization_plan_limits(uuid) from public, anon;
grant execute on function public.get_organization_plan_limits(uuid) to authenticated;

revoke all on function public.check_organization_limit(text) from public, anon;
grant execute on function public.check_organization_limit(text) to authenticated;

revoke all on function public.assert_organization_limit(text) from public, anon;
grant execute on function public.assert_organization_limit(text) to authenticated;
