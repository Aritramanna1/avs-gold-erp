create or replace function public.set_organization_feature(
  p_organization_id uuid,
  p_feature_key text,
  p_enabled boolean,
  p_reason text
) returns public.organization_features
language plpgsql
security definer
set search_path = public
as $$
declare result public.organization_features;
begin
  if not public.is_saas_admin() then
    raise exception 'platform admin role required' using errcode = '42501';
  end if;
  if nullif(trim(p_feature_key), '') is null or nullif(trim(p_reason), '') is null then
    raise exception 'feature key and reason are required' using errcode = '22023';
  end if;
  insert into public.organization_features(organization_id, feature_key, enabled, source)
  values (p_organization_id, trim(p_feature_key), p_enabled, 'manual')
  on conflict (organization_id, feature_key) do update
    set enabled = excluded.enabled, source = 'manual', updated_at = now()
  returning * into result;
  insert into public.platform_audit_events(actor_id, action, organization_id, target_type, target_id, reason, after_value)
  values (auth.uid(), case when p_enabled then 'feature.enabled' else 'feature.disabled' end,
    p_organization_id, 'organization_feature', p_feature_key, trim(p_reason),
    jsonb_build_object('feature_key', p_feature_key, 'enabled', p_enabled));
  return result;
end;
$$;
revoke execute on function public.set_organization_feature(uuid,text,boolean,text) from public, anon;
grant execute on function public.set_organization_feature(uuid,text,boolean,text) to authenticated, service_role;
