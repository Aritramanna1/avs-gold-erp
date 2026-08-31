-- Reconciled from production (project dqgrrafuoxaorvyrcuuh) on 2026-08-11 — this migration was applied directly to Supabase and had no local file until now.

create or replace function public.provision_platform_firm(
  p_firm_name text,
  p_firm_slug text,
  p_plan_code text default 'trial-6mo',
  p_trial_months integer default 6,
  p_edition text default 'pilot',
  p_seats integer default 5,
  p_reason text default 'Platform firm provisioning',
  p_customer_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_branch_id text;
  v_plan_id uuid;
  v_sub_id uuid;
  v_trial_ends timestamptz;
  v_license_id text;
  v_license public.licenses;
  v_slug text := lower(trim(p_firm_slug));
  v_name text := trim(p_firm_name);
  v_customer text := coalesce(nullif(trim(p_customer_name), ''), v_name);
  v_feature_keys text[] := array[
    'billing', 'manufacturing', 'job_work', 'gst', 'bullion', 'melt_account',
    'crm_communications', 'inventory', 'repairs', 'orders', 'attendance', 'payroll',
    'hr', 'loyalty_program', 'barcode', 'hardware_integration', 'whatsapp', 'email',
    'sms', 'customer_portal', 'supplier_management', 'reports', 'analytics', 'multi_branch'
  ];
  v_key text;
begin
  if not public.is_saas_admin() then
    raise exception 'platform admin role required' using errcode = '42501';
  end if;
  if length(v_name) < 2 then
    raise exception 'firm name is required' using errcode = '22023';
  end if;
  if v_slug !~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$' then
    raise exception 'invalid firm slug' using errcode = '22023';
  end if;
  if exists (select 1 from public.organizations where slug = v_slug) then
    raise exception 'firm slug already exists: %', v_slug using errcode = '23505';
  end if;
  select id into v_plan_id from public.platform_plans where code = trim(p_plan_code) and is_active;
  if v_plan_id is null then
    raise exception 'no active plan with code %', p_plan_code using errcode = '22023';
  end if;
  v_trial_ends := now() + make_interval(months => greatest(p_trial_months, 1));
  insert into public.organizations (slug, name, license_type, is_active, data)
  values (v_slug, v_name, 'trial', true, '{}'::jsonb)
  returning id into v_org_id;
  v_branch_id := 'br_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
  insert into public.branches (id, firm_id, name, short_name, branch_type, phone, address, active, data)
  values (v_branch_id, v_org_id, 'Main Branch', 'MAIN', 'main', '', '', true, jsonb_build_object('code', 'MAIN', 'is_default', true));
  insert into public.organization_subscriptions (organization_id, plan_id, status, trial_started_at, trial_ends_at)
  values (v_org_id, v_plan_id, 'trial', now(), v_trial_ends) returning id into v_sub_id;
  insert into public.subscription_history (organization_id, subscription_id, action, after_value, actor_id, reason)
  values (v_org_id, v_sub_id, 'trial_started', jsonb_build_object('plan_code', p_plan_code, 'trial_months', p_trial_months), auth.uid(), trim(p_reason));
  foreach v_key in array v_feature_keys loop
    insert into public.organization_features (organization_id, feature_key, enabled, source)
    values (v_org_id, v_key, true, 'system')
    on conflict (organization_id, feature_key) do update set enabled = true, source = 'system', updated_at = now();
  end loop;
  v_license_id := 'AVS-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  select * into v_license from public.issue_platform_license(v_license_id, v_customer, v_name, trim(p_edition), greatest(p_seats, 1), v_trial_ends, '[]'::jsonb, trim(p_reason));
  update public.licenses set organization_id = v_org_id where license_id = v_license.license_id;
  perform public.record_platform_audit('firm.provisioned', v_org_id, 'organization', v_org_id::text, trim(p_reason), null,
    jsonb_build_object('organization_id', v_org_id, 'branch_id', v_branch_id, 'subscription_id', v_sub_id, 'license_id', v_license.license_id, 'trial_ends_at', v_trial_ends));
  return jsonb_build_object('organization_id', v_org_id, 'branch_id', v_branch_id, 'subscription_id', v_sub_id, 'plan_code', p_plan_code,
    'trial_ends_at', v_trial_ends, 'license_id', v_license.license_id, 'edition', v_license.edition, 'seats', v_license.seats, 'firm_name', v_name, 'firm_slug', v_slug);
end;
$$;

revoke all on function public.provision_platform_firm(text, text, text, integer, text, integer, text, text) from public, anon;
grant execute on function public.provision_platform_firm(text, text, text, integer, text, integer, text, text) to authenticated, service_role;

create or replace function public.complete_firm_setup(
  p_organization_id uuid,
  p_plan_code text default 'trial-6mo',
  p_trial_months integer default 6,
  p_edition text default 'pilot',
  p_seats integer default 5,
  p_reason text default 'Complete firm licensing setup'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org public.organizations;
  v_plan_id uuid;
  v_sub_id uuid;
  v_trial_ends timestamptz;
  v_license_id text;
  v_existing_license_id text;
  v_feature_keys text[] := array[
    'billing', 'manufacturing', 'job_work', 'gst', 'bullion', 'melt_account',
    'crm_communications', 'inventory', 'repairs', 'orders', 'attendance', 'payroll',
    'hr', 'loyalty_program', 'barcode', 'hardware_integration', 'whatsapp', 'email',
    'sms', 'customer_portal', 'supplier_management', 'reports', 'analytics', 'multi_branch'
  ];
  v_key text;
begin
  if not public.is_saas_admin() then raise exception 'platform admin role required' using errcode = '42501'; end if;
  select * into v_org from public.organizations where id = p_organization_id;
  if v_org.id is null then raise exception 'organization not found' using errcode = '22023'; end if;
  select id into v_plan_id from public.platform_plans where code = trim(p_plan_code) and is_active;
  if v_plan_id is null then raise exception 'no active plan with code %', p_plan_code using errcode = '22023'; end if;
  v_trial_ends := now() + make_interval(months => greatest(p_trial_months, 1));
  if not exists (select 1 from public.branches where firm_id = v_org.id) then
    insert into public.branches (id, firm_id, name, short_name, branch_type, phone, address, active, data)
    values ('br_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12), v_org.id, 'Main Branch', 'MAIN', 'main', '', '', true, jsonb_build_object('code', 'MAIN', 'is_default', true));
  end if;
  insert into public.organization_subscriptions (organization_id, plan_id, status, trial_started_at, trial_ends_at)
  values (v_org.id, v_plan_id, 'trial', now(), v_trial_ends)
  on conflict (organization_id) do update set plan_id = excluded.plan_id, status = 'trial', trial_started_at = now(), trial_ends_at = excluded.trial_ends_at, updated_at = now()
  returning id into v_sub_id;
  foreach v_key in array v_feature_keys loop
    insert into public.organization_features (organization_id, feature_key, enabled, source)
    values (v_org.id, v_key, true, 'system')
    on conflict (organization_id, feature_key) do update set enabled = true, source = 'system', updated_at = now();
  end loop;
  select l.license_id into v_existing_license_id from public.licenses l where l.organization_id = v_org.id and l.status = 'active' order by l.created_at desc limit 1;
  if v_existing_license_id is not null then v_license_id := v_existing_license_id;
  else
    v_license_id := 'AVS-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    perform public.issue_platform_license(v_license_id, v_org.name, v_org.name, trim(p_edition), greatest(p_seats, 1), v_trial_ends, '[]'::jsonb, trim(p_reason));
    update public.licenses set organization_id = v_org.id where license_id = v_license_id;
  end if;
  perform public.record_platform_audit('firm.setup_completed', v_org.id, 'organization', v_org.id::text, trim(p_reason), null, jsonb_build_object('license_id', v_license_id, 'trial_ends_at', v_trial_ends));
  return jsonb_build_object('organization_id', v_org.id, 'subscription_id', v_sub_id, 'plan_code', p_plan_code, 'trial_ends_at', v_trial_ends, 'license_id', v_license_id, 'firm_name', v_org.name, 'firm_slug', v_org.slug);
end;
$$;

revoke all on function public.complete_firm_setup(uuid, text, integer, text, integer, text) from public, anon;
grant execute on function public.complete_firm_setup(uuid, text, integer, text, integer, text) to authenticated, service_role;
