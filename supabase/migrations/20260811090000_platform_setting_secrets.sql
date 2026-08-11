-- Secret-aware platform settings: a secret value must never come back to the
-- browser after being saved (masked in the settings list) and must never
-- land in plaintext in the audit trail either (platform_audit_events is
-- readable in the Activity view, which would otherwise leak it right back).
create or replace function public.set_platform_setting(
  p_key text,
  p_value jsonb,
  p_reason text,
  p_is_secret boolean default false
) returns public.platform_settings
language plpgsql
security definer
set search_path = public
as $$
declare
  previous jsonb;
  previous_secret boolean;
  result public.platform_settings;
  audit_before jsonb;
  audit_after jsonb;
begin
  if not public.is_saas_admin() then
    raise exception 'platform admin role required' using errcode = '42501';
  end if;
  if nullif(trim(p_key), '') is null or nullif(trim(p_reason), '') is null then
    raise exception 'setting key and reason are required' using errcode = '22023';
  end if;
  select value, is_secret into previous, previous_secret
  from public.platform_settings where key = trim(p_key);

  insert into public.platform_settings(key, value, is_secret, updated_by)
  values (trim(p_key), coalesce(p_value, '{}'::jsonb), coalesce(p_is_secret, false), auth.uid())
  on conflict (key) do update
    set value = excluded.value, is_secret = excluded.is_secret,
        updated_by = excluded.updated_by, updated_at = now()
  returning * into result;

  audit_before := case when previous_secret then '"[redacted]"'::jsonb else previous end;
  audit_after := case when result.is_secret then '"[redacted]"'::jsonb else result.value end;

  insert into public.platform_audit_events(actor_id, action, target_type, target_id, reason, before_value, after_value)
  values (auth.uid(), 'platform_setting.updated', 'platform_setting', trim(p_key), trim(p_reason), audit_before, audit_after);
  return result;
end;
$$;
revoke execute on function public.set_platform_setting(text,jsonb,text,boolean) from public, anon;
grant execute on function public.set_platform_setting(text,jsonb,text,boolean) to authenticated, service_role;

-- The old 3-arg signature is now redundant; keep it working (defaults
-- is_secret to false) rather than a breaking rename.
drop function if exists public.set_platform_setting(text,jsonb,text);
create or replace function public.set_platform_setting(
  p_key text,
  p_value jsonb,
  p_reason text
) returns public.platform_settings
language sql
security definer
set search_path = public
as $$
  select public.set_platform_setting(p_key, p_value, p_reason, false);
$$;
revoke execute on function public.set_platform_setting(text,jsonb,text) from public, anon;
grant execute on function public.set_platform_setting(text,jsonb,text) to authenticated, service_role;
