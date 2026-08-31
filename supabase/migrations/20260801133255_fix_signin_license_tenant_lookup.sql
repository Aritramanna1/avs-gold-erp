-- Reconciled from production (project dqgrrafuoxaorvyrcuuh) on 2026-08-11 — this migration was applied directly to Supabase and had no local file until now.

-- Sign-in fix: tenants with active trial subscriptions were blocked at LicenseGate
-- because license keys were not linked to organization_id and get_my_tenant_license_key
-- returned null. Link legacy keys and add subscription entitlement fallback.

begin;

-- Backfill organization_id on licenses issued before firm linkage existed.
update public.licenses l
set organization_id = o.id
from public.organizations o
where l.organization_id is null
  and lower(trim(l.company_name)) = lower(trim(o.name));

-- Also link by slug when company_name differs slightly (QA playwright key).
update public.licenses l
set organization_id = o.id
from public.organizations o
where l.organization_id is null
  and l.license_id like 'MTJ-QA-PLAYWRIGHT%'
  and o.slug = 'mtj-qa-firm-a';

create or replace function public.get_my_tenant_license_key()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_firm_id uuid := public.my_firm_id();
  v_org_name text;
  v_key text;
begin
  if v_firm_id is null then
    return null;
  end if;

  select l.license_id into v_key
  from public.licenses l
  where l.organization_id = v_firm_id
    and l.status = 'active'
  order by l.created_at desc
  limit 1;

  if v_key is not null then
    return v_key;
  end if;

  select o.name into v_org_name
  from public.organizations o
  where o.id = v_firm_id;

  if v_org_name is not null then
    select l.license_id into v_key
    from public.licenses l
    where l.organization_id is null
      and l.status = 'active'
      and lower(trim(l.company_name)) = lower(trim(v_org_name))
    order by l.created_at desc
    limit 1;
  end if;

  return v_key;
end;
$$;

revoke all on function public.get_my_tenant_license_key() from public, anon;
grant execute on function public.get_my_tenant_license_key() to authenticated;

-- Subscription entitlement for online builds when no explicit license key is stored locally.
create or replace function public.get_my_tenant_subscription_entitlement()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_firm_id uuid := public.my_firm_id();
  v_sub public.organization_subscriptions;
  v_trial_ends_ms bigint;
  v_renews_ms bigint;
  v_valid boolean := false;
  v_status text;
  v_message text;
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
    'edition', 'Trial'
  );
end;
$$;

revoke all on function public.get_my_tenant_subscription_entitlement() from public, anon;
grant execute on function public.get_my_tenant_subscription_entitlement() to authenticated;

commit;
