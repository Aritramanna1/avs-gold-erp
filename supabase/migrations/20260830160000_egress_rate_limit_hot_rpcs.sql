-- Server-side rate limits for expensive authenticated RPCs (egress/CPU abuse guard).
-- Does not weaken RLS; per-user buckets only.

create table if not exists public.egress_rate_limit_buckets (
  user_id uuid not null,
  bucket text not null,
  window_start timestamptz not null,
  hit_count int not null default 0,
  primary key (user_id, bucket)
);

alter table public.egress_rate_limit_buckets enable row level security;

revoke all on table public.egress_rate_limit_buckets from public, anon, authenticated;

create or replace function public.enforce_egress_rate_limit(
  p_bucket text,
  p_max_hits int,
  p_window_seconds int
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_now timestamptz := now();
  v_window timestamptz;
  v_count int;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_bucket is null or length(trim(p_bucket)) = 0 then
    raise exception 'invalid rate limit bucket';
  end if;

  select window_start, hit_count
  into v_window, v_count
  from public.egress_rate_limit_buckets
  where user_id = v_uid and bucket = p_bucket
  for update;

  if not found then
    insert into public.egress_rate_limit_buckets (user_id, bucket, window_start, hit_count)
    values (v_uid, p_bucket, v_now, 1);
    return;
  end if;

  if v_window + make_interval(secs => p_window_seconds) <= v_now then
    update public.egress_rate_limit_buckets
    set window_start = v_now, hit_count = 1
    where user_id = v_uid and bucket = p_bucket;
    return;
  end if;

  if v_count >= p_max_hits then
    raise exception 'rate limit exceeded (% per %s)', p_max_hits, p_window_seconds
      using errcode = 'P0001';
  end if;

  update public.egress_rate_limit_buckets
  set hit_count = hit_count + 1
  where user_id = v_uid and bucket = p_bucket;
end;
$$;

revoke all on function public.enforce_egress_rate_limit(text, int, int) from public, anon;
grant execute on function public.enforce_egress_rate_limit(text, int, int) to authenticated, service_role;

-- Gold ledger page RPC (paginated; COUNT skips on timeout)
create or replace function public.get_gold_ledger_page(
  p_bucket text default null,
  p_purity text default null,
  p_type text default null,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_limit int default 100,
  p_offset int default 0
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_rows jsonb;
  v_total bigint := -1;
  v_limit int := greatest(1, least(coalesce(p_limit, 100), 500));
  v_offset int := greatest(0, coalesce(p_offset, 0));
begin
  perform public.enforce_egress_rate_limit('rpc:gold_ledger_page', 90, 60);

  select coalesce(jsonb_agg(row_to_json(t)::jsonb order by t.ts asc), '[]'::jsonb)
  into v_rows
  from (
    select gl.id, gl.ts, gl.net_fine_mg, gl.bucket_deltas, gl.data
    from public.gold_ledger gl
    where gl.firm_id = public.my_firm_id()
      and (p_from is null or gl.ts >= p_from)
      and (p_to is null or gl.ts <= p_to)
      and (p_bucket is null or (gl.bucket_deltas ? p_bucket))
      and (p_purity is null or gl.data->>'purity' = p_purity)
      and (p_type is null or gl.data->>'type' = p_type)
    order by gl.ts asc
    limit v_limit
    offset v_offset
  ) t;

  begin
    perform set_config('statement_timeout', '8000', true);
    select count(*) into v_total
    from public.gold_ledger gl
    where gl.firm_id = public.my_firm_id()
      and (p_from is null or gl.ts >= p_from)
      and (p_to is null or gl.ts <= p_to)
      and (p_bucket is null or (gl.bucket_deltas ? p_bucket))
      and (p_purity is null or gl.data->>'purity' = p_purity)
      and (p_type is null or gl.data->>'type' = p_type);
  exception
    when query_canceled then
      v_total := -1;
  end;

  perform set_config('statement_timeout', '0', true);

  return jsonb_build_object('rows', v_rows, 'total', v_total, 'limit', v_limit, 'offset', v_offset);
end;
$$;

-- Authorization context: canonical body + rate limit (120/min per user)
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

  perform public.enforce_egress_rate_limit('rpc:auth_context', 120, 60);

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
