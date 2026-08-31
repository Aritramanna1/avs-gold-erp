-- Fix login break: get_authorization_context was STABLE but called enforce_egress_rate_limit
-- (SELECT FOR UPDATE + writes) → PostgREST read-only transaction error 25006 / HTTP 405.
-- Auth credentials were always valid; workspace bootstrap failed after sign-in.
-- Append-only, forward-safe. Does NOT alter user/membership data.

begin;

create or replace function public.get_authorization_context()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_is_platform boolean := false;
  v_active_org uuid;
  v_active_portal text;
  v_active_membership_id uuid;
  v_active_branch text;
  v_pref_org uuid;
  v_pref_portal text;
  v_workspaces jsonb;
  v_active jsonb;
  v_default_route text;
  v_active_type text;
begin
  if v_uid is null then return null; end if;

  -- Rate limit removed from auth bootstrap — must never block login (see 20260830240000).

  v_is_platform := public.is_saas_admin() or exists (
    select 1 from public.user_roles ur
    where ur.user_id = v_uid
      and ur.role::text in ('saas_admin', 'SaaS Admin', 'platform_owner', 'Platform Owner')
  );

  select last_active_organization_id, last_active_portal_type
  into v_pref_org, v_pref_portal
  from public.user_preferences
  where auth_user_id = v_uid;

  select organization_id, portal_type, membership_id, branch_id
  into v_active_org, v_active_portal, v_active_membership_id, v_active_branch
  from public.identity_active_context
  where auth_user_id = v_uid;

  if v_is_platform and v_active_org is null and v_active_portal is null then
    v_active_type := 'platform';
  elsif v_active_portal is not null then
    v_active_type := v_active_portal;
  elsif v_active_org is not null then
    v_active_type := 'erp';
  else
    v_active_type := null;
  end if;

  select coalesce(jsonb_agg(ws order by ws ->> 'organization_name', ws ->> 'workspace_type'), '[]'::jsonb)
  into v_workspaces
  from (
    select jsonb_build_object(
      'workspace_key', tm.organization_id::text || ':' || public.workspace_type_for_membership(tm),
      'workspace_type', public.workspace_type_for_membership(tm),
      'organization_id', tm.organization_id,
      'organization_name', o.name,
      'membership_id', tm.id,
      'membership_kind', tm.membership_kind,
      'portal_type', tm.portal_type,
      'role', tm.role,
      'branch_ids', tm.branch_ids,
      'party_roles', coalesce((
        select jsonb_agg(distinct pi.portal_type)
        from public.portal_identities pi
        where pi.auth_user_id = v_uid
          and pi.firm_id = tm.organization_id
          and pi.status = 'active'
      ), '[]'::jsonb),
      'route', public.workspace_route_for_membership(tm),
      'is_active',
        tm.organization_id = v_active_org
        and public.workspace_type_for_membership(tm) = coalesce(v_active_type, public.workspace_type_for_membership(tm))
    ) as ws
    from public.tenant_memberships tm
    join public.organizations o on o.id = tm.organization_id
    where tm.auth_user_id = v_uid and tm.status = 'active'
  ) sub;

  if v_is_platform then
    v_workspaces := coalesce(v_workspaces, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'workspace_key', 'platform:platform',
      'workspace_type', 'platform',
      'organization_id', null,
      'organization_name', 'Platform Owner',
      'membership_kind', 'platform',
      'portal_type', null,
      'role', 'saas_admin',
      'route', '/platform',
      'is_active', v_active_type = 'platform'
    ));
  end if;

  select jsonb_build_object(
    'workspace_key',
      case
        when v_active_type = 'platform' then 'platform:platform'
        when v_active_org is not null then v_active_org::text || ':' || coalesce(v_active_type, 'erp')
        else null
      end,
    'workspace_type', coalesce(v_active_type, 'erp'),
    'organization_id', v_active_org,
    'portal_type', v_active_portal,
    'membership_id', v_active_membership_id,
    'branch_id', v_active_branch
  ) into v_active;

  v_default_route := public.resolve_default_workspace_route(v_uid, v_pref_org, v_pref_portal);

  return jsonb_build_object(
    'is_platform_owner', v_is_platform,
    'workspaces', coalesce(v_workspaces, '[]'::jsonb),
    'active_workspace', v_active,
    'default_route', v_default_route,
    'auth_user_id', v_uid
  );
end;
$$;

revoke all on function public.get_authorization_context() from public, anon;
grant execute on function public.get_authorization_context() to authenticated;

commit;
