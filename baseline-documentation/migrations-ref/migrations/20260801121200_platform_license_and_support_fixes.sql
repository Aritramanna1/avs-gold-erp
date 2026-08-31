-- Reconciled from production (project dqgrrafuoxaorvyrcuuh) on 2026-08-11 — this migration was applied directly to Supabase and had no local file until now.

-- License issuance + validation for online web builds; support chat bootstrap.

create or replace function public.get_my_tenant_license_key()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_firm_id uuid := public.my_firm_id();
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
  return v_key;
end;
$$;

revoke all on function public.get_my_tenant_license_key() from public, anon;
grant execute on function public.get_my_tenant_license_key() to authenticated;

create or replace function public.validate_license(
  p_license_key text,
  p_device_id text,
  p_deployment_mode text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_license public.licenses;
  v_entitlement jsonb;
  v_valid boolean;
  v_expiry_ms bigint;
  v_message text;
begin
  select * into v_license
  from public.licenses
  where license_id = trim(p_license_key);

  if not found then
    return json_build_object(
      'valid', false,
      'message', 'Invalid license key.',
      'customerStatus', 'invalid'
    );
  end if;

  v_valid := v_license.status = 'active'
    and (v_license.expiry_date is null or v_license.expiry_date > now());

  v_expiry_ms := case
    when v_license.expiry_date is null then null
    else (extract(epoch from v_license.expiry_date) * 1000)::bigint
  end;

  v_message := case
    when v_license.status != 'active' then 'License is ' || v_license.status
    when v_license.expiry_date is not null and v_license.expiry_date <= now() then 'License has expired'
    else 'License is valid'
  end;

  begin
    v_entitlement := v_license.payload::jsonb;
  exception when others then
    v_entitlement := '{}'::jsonb;
  end;

  v_entitlement := v_entitlement
    || jsonb_build_object(
      'licenseId', v_license.license_id,
      'deviceId', coalesce(nullif(trim(p_device_id), ''), '*'),
      'status', case when v_valid then 'active' else 'expired' end,
      'expiresAt', v_expiry_ms,
      'seats', v_license.seats,
      'edition', v_license.edition,
      'customerStatus', v_license.status
    );

  return json_build_object(
    'valid', v_valid,
    'edition', v_license.edition,
    'expiry', v_license.expiry_date,
    'maximumDevices', v_license.seats,
    'customerStatus', v_license.status,
    'entitlement', v_entitlement,
    'signature', v_license.signature,
    'message', v_message
  );
end;
$$;

revoke all on function public.validate_license(text, text, text) from public;
grant execute on function public.validate_license(text, text, text) to anon, authenticated, service_role;

create or replace function public.issue_platform_license(
  p_license_id text,
  p_customer_name text,
  p_company_name text,
  p_edition text,
  p_seats integer default 1,
  p_expiry timestamptz default null,
  p_features jsonb default '[]'::jsonb,
  p_reason text default null,
  p_organization_id uuid default null
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
    'seats', greatest(p_seats, 1),
    'features', coalesce(p_features, '[]'::jsonb),
    'edition', trim(p_edition),
    'customerStatus', 'active'
  );

  insert into public.licenses (
    license_id, customer_name, company_name, status, edition, seats, expiry_date,
    payload, signature, organization_id
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
    'managed-server-license',
    p_organization_id
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
    organization_id = coalesce(excluded.organization_id, public.licenses.organization_id),
    updated_at = now()
  returning * into v_row;

  perform public.record_platform_audit(
    'license.issued',
    p_organization_id,
    'license',
    v_row.license_id,
    p_reason,
    null,
    to_jsonb(v_row)
  );

  return v_row;
end;
$$;

revoke all on function public.issue_platform_license(
  text, text, text, text, integer, timestamptz, jsonb, text, uuid
) from public;
grant execute on function public.issue_platform_license(
  text, text, text, text, integer, timestamptz, jsonb, text, uuid
) to authenticated;

create or replace function public.create_firm_support_ticket(
  p_subject text,
  p_description text,
  p_category text default 'general',
  p_priority text default 'normal'
)
returns public.platform_support_tickets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.user_profiles;
  v_ticket public.platform_support_tickets;
  v_conversation_id uuid;
  v_priority text := lower(trim(coalesce(p_priority, 'normal')));
begin
  if length(trim(coalesce(p_subject, ''))) < 3 or length(trim(coalesce(p_subject, ''))) > 160 then
    raise exception 'subject must be between 3 and 160 characters' using errcode = '22023';
  end if;
  if length(trim(coalesce(p_description, ''))) < 10 or length(trim(coalesce(p_description, ''))) > 10000 then
    raise exception 'description must be between 10 and 10000 characters' using errcode = '22023';
  end if;
  if v_priority not in ('low', 'normal', 'high', 'urgent') then
    raise exception 'invalid priority' using errcode = '22023';
  end if;

  select * into v_profile
  from public.user_profiles
  where auth_id = auth.uid()
    and active
    and status = 'active'
    and firm_id is not null
    and lower(coalesce(role, '')) <> 'customer'
  limit 1;

  if not found then
    raise exception 'firm support access is not configured' using errcode = '42501';
  end if;

  insert into public.platform_support_tickets
    (ticket_no, firm_id, branch_id, requester_id, category, subject, description, priority)
  values
    (
      'FIRM-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') || '-' ||
        upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)),
      v_profile.firm_id,
      v_profile.branch_id,
      auth.uid(),
      left(trim(coalesce(p_category, 'general')), 80),
      trim(p_subject),
      trim(p_description),
      v_priority
    )
  returning * into v_ticket;

  select c.id into v_conversation_id
  from public.platform_conversations c
  where c.ticket_id = v_ticket.id;

  if v_conversation_id is null then
    insert into public.platform_conversations (firm_id, ticket_id, status)
    values (v_ticket.firm_id, v_ticket.id, 'open')
    returning id into v_conversation_id;
  end if;

  insert into public.platform_conversation_messages (conversation_id, sender_id, body, visibility)
  values (v_conversation_id, auth.uid(), trim(p_description), 'customer');

  return v_ticket;
end;
$$;

insert into public.platform_conversations (firm_id, ticket_id, status)
select t.firm_id, t.id, 'open'
from public.platform_support_tickets t
where not exists (
  select 1 from public.platform_conversations c where c.ticket_id = t.id
);
