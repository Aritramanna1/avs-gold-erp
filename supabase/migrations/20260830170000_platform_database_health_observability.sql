-- Platform Owner: real database health + egress observability (saas_admin only).
-- Reads live PostgreSQL stats and platform telemetry tables — no fabricated metrics.

begin;

create or replace function public.get_platform_database_health()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_started timestamptz := clock_timestamp();
  v_ping_ms int;
  v_db_size bigint;
  v_connections int;
  v_errors_1h int;
  v_errors_24h int;
  v_critical_24h int;
  v_orgs int;
  v_active_orgs int;
  v_subs int;
  v_rate_buckets jsonb;
  v_table_stats jsonb;
  v_errors_by_category jsonb;
begin
  if not public.is_saas_admin() then
    raise exception 'platform admin role required' using errcode = '42501';
  end if;

  select pg_database_size(current_database()) into v_db_size;
  select count(*)::int
    into v_connections
    from pg_stat_activity
   where datname = current_database();

  select count(*)::int into v_errors_1h
    from public.platform_error_events
   where created_at > now() - interval '1 hour';

  select count(*)::int into v_errors_24h
    from public.platform_error_events
   where created_at > now() - interval '24 hours';

  select count(*)::int into v_critical_24h
    from public.platform_error_events
   where created_at > now() - interval '24 hours'
     and severity = 'critical';

  select count(*)::int into v_orgs from public.organizations;
  select count(*)::int into v_active_orgs from public.organizations where is_active = true;

  select count(*)::int into v_subs
    from public.subscriptions
   where status in ('active', 'trial', 'trialing', 'TRIAL_ACTIVE', 'ACTIVE');

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'bucket', s.bucket,
        'users', s.user_count,
        'hits', s.total_hits
      )
      order by s.total_hits desc
    ),
    '[]'::jsonb
  )
  into v_rate_buckets
  from (
    select
      bucket,
      count(distinct user_id)::int as user_count,
      sum(hit_count)::int as total_hits
    from public.egress_rate_limit_buckets
    group by bucket
    order by sum(hit_count) desc
    limit 20
  ) s;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'table', t.relname,
        'live_rows', t.n_live_tup,
        'size_bytes', pg_total_relation_size(t.relid)
      )
      order by pg_total_relation_size(t.relid) desc
    ),
    '[]'::jsonb
  )
  into v_table_stats
  from (
    select relname, n_live_tup, relid
    from pg_stat_user_tables
    where schemaname = 'public'
    order by pg_total_relation_size(relid) desc
    limit 12
  ) t;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'category', c.category,
        'count', c.cnt,
        'critical', c.critical_cnt
      )
      order by c.cnt desc
    ),
    '[]'::jsonb
  )
  into v_errors_by_category
  from (
    select
      category,
      count(*)::int as cnt,
      count(*) filter (where severity = 'critical')::int as critical_cnt
    from public.platform_error_events
    where created_at > now() - interval '24 hours'
    group by category
    order by count(*) desc
    limit 15
  ) c;

  v_ping_ms := extract(milliseconds from clock_timestamp() - v_started)::int;

  return jsonb_build_object(
    'ok', true,
    'checked_at', now(),
    'ping_ms', v_ping_ms,
    'database_size_bytes', v_db_size,
    'active_connections', v_connections,
    'errors_last_1h', v_errors_1h,
    'errors_last_24h', v_errors_24h,
    'critical_errors_last_24h', v_critical_24h,
    'errors_by_category_24h', v_errors_by_category,
    'total_organizations', v_orgs,
    'active_organizations', v_active_orgs,
    'active_subscriptions', v_subs,
    'rate_limit_buckets', v_rate_buckets,
    'largest_tables', v_table_stats
  );
end;
$$;

revoke all on function public.get_platform_database_health() from public, anon;
grant execute on function public.get_platform_database_health() to authenticated, service_role;

-- Egress / API pressure observability from DB-visible signals (rate limits + error telemetry).
create or replace function public.get_platform_egress_observability()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_started timestamptz := clock_timestamp();
  v_rate_total_hits int;
  v_rate_users int;
  v_rate_buckets jsonb;
  v_errors_1h jsonb;
  v_postgres_signals jsonb;
begin
  if not public.is_saas_admin() then
    raise exception 'platform admin role required' using errcode = '42501';
  end if;

  select coalesce(sum(hit_count), 0)::int, count(distinct user_id)::int
    into v_rate_total_hits, v_rate_users
    from public.egress_rate_limit_buckets;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'bucket', bucket,
        'users', user_count,
        'hits', total_hits,
        'window_start', window_start
      )
      order by total_hits desc
    ),
    '[]'::jsonb
  )
  into v_rate_buckets
  from (
    select
      bucket,
      count(distinct user_id)::int as user_count,
      sum(hit_count)::int as total_hits,
      max(window_start) as window_start
    from public.egress_rate_limit_buckets
    group by bucket
    order by sum(hit_count) desc
    limit 30
  ) s;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'hour', date_trunc('hour', created_at),
        'count', cnt,
        'critical', critical_cnt
      )
      order by date_trunc('hour', created_at) desc
    ),
    '[]'::jsonb
  )
  into v_errors_1h
  from (
    select
      date_trunc('hour', created_at) as created_at,
      count(*)::int as cnt,
      count(*) filter (where severity = 'critical')::int as critical_cnt
    from public.platform_error_events
    where created_at > now() - interval '24 hours'
    group by 1
    order by 1 desc
    limit 24
  ) h;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'message', left(message, 200),
        'category', category,
        'severity', severity,
        'created_at', created_at
      )
      order by created_at desc
    ),
    '[]'::jsonb
  )
  into v_postgres_signals
  from (
    select message, category, severity, created_at
    from public.platform_error_events
    where created_at > now() - interval '24 hours'
      and (
        message ilike '%57014%'
        or message ilike '%timeout%'
        or message ilike '%postgres%'
        or message ilike '%PGRST%'
        or message ilike '%rate limit%'
        or category ilike '%database%'
        or category ilike '%supabase%'
      )
    order by created_at desc
    limit 25
  ) e;

  return jsonb_build_object(
    'ok', true,
    'checked_at', now(),
    'query_ms', extract(milliseconds from clock_timestamp() - v_started)::int,
    'rate_limit_total_hits', v_rate_total_hits,
    'rate_limit_distinct_users', v_rate_users,
    'rate_limit_buckets', v_rate_buckets,
    'error_events_by_hour_24h', v_errors_1h,
    'postgres_related_errors_24h', v_postgres_signals,
    'note', 'Supabase REST/Auth/Realtime gateway counts are measured client-side via window.__ORNEXA_EGRESS__ on owner sessions; this RPC reports PostgreSQL-visible pressure (rate limits + error telemetry).'
  );
end;
$$;

revoke all on function public.get_platform_egress_observability() from public, anon;
grant execute on function public.get_platform_egress_observability() to authenticated, service_role;

commit;
