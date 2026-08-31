-- Reconciled from production (project dqgrrafuoxaorvyrcuuh) on 2026-08-11 — this migration was applied directly to Supabase and had no local file until now.

-- validate_license entitlement must include issuedAt/notBefore

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
  v_issued_ms bigint;
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

  v_issued_ms := (extract(epoch from coalesce(v_license.created_at, now())) * 1000)::bigint;

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
      'keyId', 'platform',
      'deviceId', coalesce(nullif(trim(p_device_id), ''), '*'),
      'status', case when v_valid then 'active' else 'expired' end,
      'issuedAt', v_issued_ms,
      'notBefore', v_issued_ms,
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
