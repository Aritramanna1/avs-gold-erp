-- Reconciled from production (project dqgrrafuoxaorvyrcuuh) on 2026-08-11 — this migration was applied directly to Supabase and had no local file until now.

create or replace function public.require_organization_feature(p_feature_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.organization_feature_enabled(p_feature_key) then
    raise exception 'module not licensed: %', p_feature_key using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.require_organization_feature(text) from public;
grant execute on function public.require_organization_feature(text) to authenticated;

create or replace function public.issue_platform_license(
  p_license_id text,
  p_customer_name text,
  p_company_name text,
  p_edition text,
  p_seats integer default 1,
  p_expiry timestamptz default null,
  p_features jsonb default '[]'::jsonb,
  p_reason text default null
)
returns public.licenses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.licenses;
  v_payload jsonb;
begin
  if not public.is_saas_admin() then
    raise exception 'platform admin role required' using errcode = '42501';
  end if;

  v_payload := jsonb_build_object(
    'version', 1,
    'licenseId', trim(p_license_id),
    'keyId', 'platform',
    'deviceId', '*',
    'status', 'active',
    'issuedAt', (extract(epoch from now()) * 1000)::bigint,
    'notBefore', (extract(epoch from now()) * 1000)::bigint,
    'expiresAt', case when p_expiry is null then null else (extract(epoch from p_expiry) * 1000)::bigint end,
    'offlineValidUntil', null,
    'seats', p_seats,
    'features', coalesce(p_features, '[]'::jsonb),
    'edition', p_edition,
    'customerStatus', 'active'
  );

  insert into public.licenses (
    license_id, customer_name, company_name, status, edition, seats, expiry_date, payload, signature
  )
  values (
    trim(p_license_id),
    trim(p_customer_name),
    trim(p_company_name),
    'active',
    trim(p_edition),
    greatest(p_seats, 1),
    p_expiry,
    v_payload::text,
    'pending-edge-function-signature'
  )
  on conflict (license_id) do update
  set
    customer_name = excluded.customer_name,
    company_name = excluded.company_name,
    status = 'active',
    edition = excluded.edition,
    seats = excluded.seats,
    expiry_date = excluded.expiry_date,
    payload = excluded.payload,
    updated_at = now()
  returning * into v_row;

  perform public.record_platform_audit(
    'license.issued',
    null,
    'license',
    v_row.license_id,
    p_reason,
    null,
    to_jsonb(v_row)
  );

  return v_row;
end;
$$;

create or replace function public.renew_platform_license(
  p_license_id text,
  p_new_expiry timestamptz,
  p_reason text default null
)
returns public.licenses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before jsonb;
  v_row public.licenses;
  v_payload jsonb;
begin
  if not public.is_saas_admin() then
    raise exception 'platform admin role required' using errcode = '42501';
  end if;

  select to_jsonb(l) into v_before from public.licenses l where license_id = trim(p_license_id) for update;
  if v_before is null then raise exception 'license not found'; end if;

  v_payload := (v_before->>'payload')::jsonb;
  v_payload := jsonb_set(v_payload, '{status}', '"active"');
  v_payload := jsonb_set(
    v_payload,
    '{expiresAt}',
    to_jsonb((extract(epoch from p_new_expiry) * 1000)::bigint)
  );

  update public.licenses
  set status = 'active', expiry_date = p_new_expiry, payload = v_payload::text, updated_at = now()
  where license_id = trim(p_license_id)
  returning * into v_row;

  perform public.record_platform_audit('license.renewed', null, 'license', v_row.license_id, p_reason, v_before, to_jsonb(v_row));

  return v_row;
end;
$$;

create or replace function public.suspend_platform_license(
  p_license_id text,
  p_reason text default null
)
returns public.licenses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before jsonb;
  v_row public.licenses;
  v_payload jsonb;
begin
  if not public.is_saas_admin() then
    raise exception 'platform admin role required' using errcode = '42501';
  end if;

  select to_jsonb(l) into v_before from public.licenses l where license_id = trim(p_license_id) for update;
  if v_before is null then raise exception 'license not found'; end if;

  v_payload := (v_before->>'payload')::jsonb;
  v_payload := jsonb_set(v_payload, '{status}', '"suspended"');

  update public.licenses
  set status = 'suspended', payload = v_payload::text, updated_at = now()
  where license_id = trim(p_license_id)
  returning * into v_row;

  perform public.record_platform_audit('license.suspended', null, 'license', v_row.license_id, p_reason, v_before, to_jsonb(v_row));

  return v_row;
end;
$$;

revoke all on function public.issue_platform_license(text, text, text, text, integer, timestamptz, jsonb, text) from public;
grant execute on function public.issue_platform_license(text, text, text, text, integer, timestamptz, jsonb, text) to authenticated;

revoke all on function public.renew_platform_license(text, timestamptz, text) from public;
grant execute on function public.renew_platform_license(text, timestamptz, text) to authenticated;

revoke all on function public.suspend_platform_license(text, text) from public;
grant execute on function public.suspend_platform_license(text, text) to authenticated;

create or replace function public.evaluate_trial_expiry()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  update public.organization_subscriptions
  set status = 'expired', updated_at = now()
  where status = 'trial'
    and trial_ends_at is not null
    and trial_ends_at < now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.evaluate_trial_expiry() from public;
grant execute on function public.evaluate_trial_expiry() to service_role;
