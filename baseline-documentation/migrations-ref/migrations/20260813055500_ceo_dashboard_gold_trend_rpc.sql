-- CEO dashboard gold trend aggregate.
-- SECURITY INVOKER is intentional: callers see only rows allowed by current RLS.

create or replace function public.get_ceo_gold_trend(p_days integer default 30)
returns table(day date, fine_mg bigint)
language sql
stable
set search_path = public
as $$
  with bounds as (
    select
      (current_date - greatest(1, least(coalesce(p_days, 30), 90)))::date as start_day,
      current_date::date as end_day
  ),
  baseline as (
    select coalesce(sum(gl.net_fine_mg), 0)::bigint as fine_mg
    from public.gold_ledger gl
    cross join bounds b
    where gl.ts < b.start_day
  ),
  daily as (
    select date_trunc('day', gl.ts)::date as day, sum(gl.net_fine_mg)::bigint as delta_mg
    from public.gold_ledger gl
    cross join bounds b
    where gl.ts >= b.start_day
      and gl.ts < b.end_day + interval '1 day'
    group by 1
  ),
  series as (
    select generate_series(b.start_day, b.end_day, interval '1 day')::date as day
    from bounds b
  )
  select
    s.day,
    baseline.fine_mg
      + coalesce(
          sum(coalesce(d.delta_mg, 0)) over (
            order by s.day rows between unbounded preceding and current row
          ),
          0
        )::bigint as fine_mg
  from series s
  cross join baseline
  left join daily d on d.day = s.day
  order by s.day;
$$;

revoke all on function public.get_ceo_gold_trend(integer) from public, anon;
grant execute on function public.get_ceo_gold_trend(integer) to authenticated, service_role;
