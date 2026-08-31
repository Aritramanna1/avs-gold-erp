-- Align set_platform_workspace with get_authorization_context platform detection.
-- platform_owner / Platform Owner roles must activate platform workspace (not only saas_admin enum).
-- Append-only, forward-safe. Does NOT alter user/membership data.

begin;

create or replace function public.is_platform_operator()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    public.is_saas_admin()
    or exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role::text in (
          'saas_admin',
          'SaaS Admin',
          'platform_owner',
          'Platform Owner'
        )
    );
$$;

revoke all on function public.is_platform_operator() from public, anon;
grant execute on function public.is_platform_operator() to authenticated, service_role;

create or replace function public.set_platform_workspace()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if not public.is_platform_operator() then
    raise exception 'Platform admin role required' using errcode = '42501';
  end if;

  delete from public.identity_active_context where auth_user_id = auth.uid();

  insert into public.user_preferences (
    auth_user_id,
    last_active_organization_id,
    last_active_portal_type,
    updated_at
  )
  values (auth.uid(), null, null, now())
  on conflict (auth_user_id) do update set
    last_active_organization_id = null,
    last_active_portal_type = null,
    updated_at = now();

  return jsonb_build_object('workspace_type', 'platform', 'route', '/platform');
end;
$$;

revoke all on function public.set_platform_workspace() from public, anon;
grant execute on function public.set_platform_workspace() to authenticated;

commit;
