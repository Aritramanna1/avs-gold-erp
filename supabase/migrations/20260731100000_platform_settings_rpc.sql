create or replace function public.set_platform_setting(
  p_key text,
  p_value jsonb,
  p_reason text
) returns public.platform_settings
language plpgsql
security definer
set search_path = public
as $$
declare
  previous jsonb;
  result public.platform_settings;
begin
  if not public.is_saas_admin() then
    raise exception 'platform admin role required' using errcode = '42501';
  end if;
  if nullif(trim(p_key), '') is null or nullif(trim(p_reason), '') is null then
    raise exception 'setting key and reason are required' using errcode = '22023';
  end if;
  select value into previous from public.platform_settings where key = trim(p_key);
  insert into public.platform_settings(key, value, updated_by)
  values (trim(p_key), coalesce(p_value, '{}'::jsonb), auth.uid())
  on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = now()
  returning * into result;
  insert into public.platform_audit_events(actor_id, action, target_type, target_id, reason, before_value, after_value)
  values (auth.uid(), 'platform_setting.updated', 'platform_setting', trim(p_key), trim(p_reason), previous, result.value);
  return result;
end;
$$;
revoke execute on function public.set_platform_setting(text,jsonb,text) from public, anon;
grant execute on function public.set_platform_setting(text,jsonb,text) to authenticated, service_role;
