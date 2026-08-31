-- Gold ledger: desc page order for cache, skip COUNT on page>0, firm balance aggregate RPC, portal KYC doc flag.

-- Drop prior signatures so parameter defaults can change safely.
drop function if exists public.get_gold_ledger_page(text, text, text, timestamptz, timestamptz, int, int);
drop function if exists public.get_gold_ledger_page(text, text, text, timestamptz, timestamptz, int, int, text);
drop function if exists public.get_firm_ledger_balances(text, text);
drop function if exists public.mark_my_portal_kyc_doc(text, text, boolean);

-- ── get_gold_ledger_page: p_order + COUNT only on first page ─────────────────
create or replace function public.get_gold_ledger_page(
  p_bucket text default null,
  p_purity text default null,
  p_type text default null,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_limit int default 100,
  p_offset int default 0,
  p_order text default 'asc'
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
  v_desc boolean := lower(coalesce(p_order, 'asc')) = 'desc';
begin
  perform public.enforce_egress_rate_limit('rpc:gold_ledger_page', 90, 60);

  if v_desc then
    select coalesce(jsonb_agg(row_to_json(t)::jsonb order by t.ts desc), '[]'::jsonb)
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
      order by gl.ts desc
      limit v_limit
      offset v_offset
    ) t;
  else
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
  end if;

  -- COUNT only on first page — subsequent pages use has-more semantics (total = -1).
  if v_offset = 0 then
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
  end if;

  return jsonb_build_object('rows', v_rows, 'total', v_total, 'limit', v_limit, 'offset', v_offset);
end;
$$;

revoke all on function public.get_gold_ledger_page(text, text, text, timestamptz, timestamptz, int, int, text) from public, anon;
grant execute on function public.get_gold_ledger_page(text, text, text, timestamptz, timestamptz, int, int, text) to authenticated, service_role;

-- ── get_firm_ledger_balances: aggregate bucket sums without downloading rows ───
create or replace function public.get_firm_ledger_balances(
  p_branch_id text default null,
  p_metal_code text default 'gold'
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_firm uuid := public.my_firm_id();
  v_vault bigint := 0;
  v_karigar bigint := 0;
  v_finished bigint := 0;
  v_customer bigint := 0;
  v_jeweller bigint := 0;
  v_scrap bigint := 0;
  v_ledger_total bigint := 0;
  v_entry_count bigint := 0;
begin
  if v_firm is null then
    return jsonb_build_object(
      'buckets', jsonb_build_object(
        'vault', 0, 'karigar', 0, 'finished', 0,
        'customer', 0, 'jeweller', 0, 'scrap', 0
      ),
      'ledgerTotal', 0,
      'entryCount', 0,
      'totalUnderManagement', 0,
      'discrepancyMg', 0,
      'balanced', true
    );
  end if;

  perform public.enforce_egress_rate_limit('rpc:firm_ledger_balances', 60, 60);

  select
    coalesce(sum(coalesce((gl.bucket_deltas->>'vault')::bigint, 0)), 0),
    coalesce(sum(coalesce((gl.bucket_deltas->>'karigar')::bigint, 0)), 0),
    coalesce(sum(coalesce((gl.bucket_deltas->>'finished')::bigint, 0)), 0),
    coalesce(sum(coalesce((gl.bucket_deltas->>'customer')::bigint, 0)), 0),
    coalesce(sum(coalesce((gl.bucket_deltas->>'jeweller')::bigint, 0)), 0),
    coalesce(sum(coalesce((gl.bucket_deltas->>'scrap')::bigint, 0)), 0),
    coalesce(sum(gl.net_fine_mg), 0),
    count(*)
  into v_vault, v_karigar, v_finished, v_customer, v_jeweller, v_scrap, v_ledger_total, v_entry_count
  from public.gold_ledger gl
  where gl.firm_id = v_firm
    and (p_branch_id is null or p_branch_id = 'all' or gl.data->>'branchId' = p_branch_id);

  return jsonb_build_object(
    'buckets', jsonb_build_object(
      'vault', v_vault,
      'karigar', v_karigar,
      'finished', v_finished,
      'customer', v_customer,
      'jeweller', v_jeweller,
      'scrap', v_scrap
    ),
    'ledgerTotal', v_ledger_total,
    'entryCount', v_entry_count,
    'totalUnderManagement', v_vault + v_karigar + v_finished + v_customer + v_jeweller + v_scrap,
    'discrepancyMg', (v_vault + v_karigar + v_finished + v_customer + v_jeweller + v_scrap) - v_ledger_total,
    'balanced', (v_vault + v_karigar + v_finished + v_customer + v_jeweller + v_scrap) = v_ledger_total
  );
end;
$$;

revoke all on function public.get_firm_ledger_balances(text, text) from public, anon;
grant execute on function public.get_firm_ledger_balances(text, text) to authenticated, service_role;

-- ── mark_my_portal_kyc_doc: sync people.data.docs after portal/ERP upload ─────
create or replace function public.mark_my_portal_kyc_doc(
  p_party_id text,
  p_doc_key text,
  p_filed boolean
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_firm uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  v_firm := public.my_firm_id();
  if v_firm is not null and exists (
    select 1 from public.people p
    where p.id = p_party_id and p.firm_id = v_firm
  ) then
    null; -- ERP firm member path
  else
    v_firm := public.assert_portal_party_in_scope(p_party_id, null);
  end if;

  update public.people
  set
    data = jsonb_set(
      coalesce(data, '{}'::jsonb),
      array['docs', p_doc_key],
      to_jsonb(p_filed),
      true
    ),
    updated_at = now()
  where id = p_party_id
    and firm_id = v_firm;
end;
$$;

revoke all on function public.mark_my_portal_kyc_doc(text, text, boolean) from public, anon;
grant execute on function public.mark_my_portal_kyc_doc(text, text, boolean) to authenticated, service_role;
