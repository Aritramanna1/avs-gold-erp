-- Infer default active workspace when identity_active_context is empty.
-- Portal-only users were getting active_workspace.workspace_type='erp' with no is_active
-- rows → canAccessPath denied /karigar-portal, /customer-portal, etc.
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

  v_is_platform := public.is_platform_operator();

  select last_active_organization_id, last_active_portal_type
  into v_pref_org, v_pref_portal
  from public.user_preferences
  where auth_user_id = v_uid;

  select organization_id, portal_type, membership_id, branch_id
  into v_active_org, v_active_portal, v_active_membership_id, v_active_branch
  from public.identity_active_context
  where auth_user_id = v_uid;

  -- No explicit active context: infer from preferences or default membership.
  if v_active_org is null and not v_is_platform then
    if v_pref_org is not null then
      select tm.organization_id, tm.portal_type, tm.id, coalesce(tm.branch_ids[1], null)
      into v_active_org, v_active_portal, v_active_membership_id, v_active_branch
      from public.tenant_memberships tm
      where tm.auth_user_id = v_uid
        and tm.status = 'active'
        and tm.organization_id = v_pref_org
        and (
          v_pref_portal is null
          or tm.portal_type = v_pref_portal
          or (v_pref_portal = 'erp' and tm.membership_kind = 'internal')
        )
      order by
        case
          when v_pref_portal is not null and tm.portal_type = v_pref_portal then 0
          when v_pref_portal = 'erp' and tm.membership_kind = 'internal' then 0
          else 1
        end,
        tm.last_active_at desc nulls last
      limit 1;
    end if;

    if v_active_org is null then
      select tm.organization_id, tm.portal_type, tm.id, coalesce(tm.branch_ids[1], null)
      into v_active_org, v_active_portal, v_active_membership_id, v_active_branch
      from public.tenant_memberships tm
      where tm.auth_user_id = v_uid and tm.status = 'active'
      order by
        case when tm.membership_kind = 'internal' then 0 else 1 end,
        case tm.portal_type
          when 'ceo' then 1
          when 'customer' then 2
          when 'supplier' then 3
          when 'karigar' then 4
          else 9
        end,
        tm.last_active_at desc nulls last,
        tm.joined_at desc
      limit 1;
    end if;
  end if;

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
        and public.workspace_type_for_membership(tm) = coalesce(
          v_active_type,
          public.workspace_type_for_membership(tm)
        )
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

-- Update get_authorization_context to use is_platform_operator (must exist from 20260830250000).
-- Re-apply grants after replace.
revoke all on function public.get_authorization_context() from public, anon;
grant execute on function public.get_authorization_context() to authenticated;

commit;
