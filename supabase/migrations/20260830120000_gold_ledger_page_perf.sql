-- Gold ledger pagination perf: index + rows-first RPC (count skips on statement timeout).

create index if not exists gold_ledger_firm_ts_idx
  on public.gold_ledger (firm_id, ts desc);

create index if not exists gold_ledger_firm_id_idx
  on public.gold_ledger (firm_id);

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

revoke all on function public.get_gold_ledger_page(text, text, text, timestamptz, timestamptz, int, int) from public;
grant execute on function public.get_gold_ledger_page(text, text, text, timestamptz, timestamptz, int, int) to authenticated;
grant execute on function public.get_gold_ledger_page(text, text, text, timestamptz, timestamptz, int, int) to service_role;
