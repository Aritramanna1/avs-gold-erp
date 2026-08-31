-- Paginated ledger queries for Cash Book and Gold Ledger reports (SECURITY INVOKER, RLS-scoped).

create index if not exists universal_ledger_entries_firm_source_idx
  on public.universal_ledger_entries (firm_id, ((metadata->>'source')));

create or replace function public.get_company_cash_ledger_page(
  p_account_id text default null,
  p_party_id text default null,
  p_source text default null,
  p_from date default null,
  p_to date default null,
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
  v_total bigint;
begin
  select count(*) into v_total
  from public.universal_ledger_entries u
  where u.firm_id = public.my_firm_id()
    and u.reversal_ref_id is null
    and (u.cash_debit_paise > 0 or u.cash_credit_paise > 0)
    and (p_party_id is null or u.counterparty_id = p_party_id)
    and (p_source is null or u.metadata->>'source' = p_source)
    and (p_from is null or u.voucher_date::date >= p_from)
    and (p_to is null or u.voucher_date::date <= p_to)
    and (
      p_account_id is null
      or u.metadata->>'cash_or_bank_account_id' = p_account_id
      or u.metadata->>'debit_account_id' = p_account_id
      or u.metadata->>'credit_account_id' = p_account_id
      or u.metadata->>'from_account_id' = p_account_id
      or u.metadata->>'to_account_id' = p_account_id
    );

  select coalesce(jsonb_agg(row_to_json(t)::jsonb order by t.voucher_date asc, t.created_at asc), '[]'::jsonb)
  into v_rows
  from (
    select
      u.id,
      u.voucher_number,
      u.voucher_date::date as voucher_date,
      u.counterparty_id,
      u.counterparty_name,
      u.cash_debit_paise,
      u.cash_credit_paise,
      u.metadata,
      u.created_by,
      u.created_at
    from public.universal_ledger_entries u
    where u.firm_id = public.my_firm_id()
      and u.reversal_ref_id is null
      and (u.cash_debit_paise > 0 or u.cash_credit_paise > 0)
      and (p_party_id is null or u.counterparty_id = p_party_id)
      and (p_source is null or u.metadata->>'source' = p_source)
      and (p_from is null or u.voucher_date::date >= p_from)
      and (p_to is null or u.voucher_date::date <= p_to)
      and (
        p_account_id is null
        or u.metadata->>'cash_or_bank_account_id' = p_account_id
        or u.metadata->>'debit_account_id' = p_account_id
        or u.metadata->>'credit_account_id' = p_account_id
        or u.metadata->>'from_account_id' = p_account_id
        or u.metadata->>'to_account_id' = p_account_id
      )
    order by u.voucher_date asc, u.created_at asc
    limit greatest(1, least(p_limit, 500))
    offset greatest(0, p_offset)
  ) t;

  return jsonb_build_object('rows', v_rows, 'total', v_total, 'limit', p_limit, 'offset', p_offset);
end;
$$;

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
  v_total bigint;
begin
  select count(*) into v_total
  from public.gold_ledger gl
  where gl.firm_id = public.my_firm_id()
    and (p_from is null or gl.ts >= p_from)
    and (p_to is null or gl.ts <= p_to)
    and (p_bucket is null or (gl.bucket_deltas ? p_bucket))
    and (p_purity is null or gl.data->>'purity' = p_purity)
    and (p_type is null or gl.data->>'type' = p_type);

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
    limit greatest(1, least(p_limit, 500))
    offset greatest(0, p_offset)
  ) t;

  return jsonb_build_object('rows', v_rows, 'total', v_total, 'limit', p_limit, 'offset', p_offset);
end;
$$;

create or replace function public.get_party_ledger_summary()
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_result jsonb;
begin
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'party_id', party_id,
        'customer_fine_mg', customer_fine_mg,
        'entry_count', entry_count
      )
      order by abs(customer_fine_mg) desc
    ),
    '[]'::jsonb
  )
  into v_result
  from (
    select
      coalesce(gl.data->>'customerId', gl.data->>'karigarId') as party_id,
      coalesce(sum(coalesce((gl.bucket_deltas->>'customer')::bigint, 0)), 0) as customer_fine_mg,
      count(*) as entry_count
    from public.gold_ledger gl
    where gl.firm_id = public.my_firm_id()
      and (
        gl.data->>'customerId' is not null
        or gl.data->>'karigarId' is not null
      )
    group by 1
    having coalesce(gl.data->>'customerId', gl.data->>'karigarId') is not null
  ) s;

  return jsonb_build_object('parties', v_result);
end;
$$;

revoke all on function public.get_company_cash_ledger_page(text, text, text, date, date, int, int) from public;
revoke all on function public.get_gold_ledger_page(text, text, text, timestamptz, timestamptz, int, int) from public;
revoke all on function public.get_party_ledger_summary() from public;

grant execute on function public.get_company_cash_ledger_page(text, text, text, date, date, int, int) to authenticated;
grant execute on function public.get_gold_ledger_page(text, text, text, timestamptz, timestamptz, int, int) to authenticated;
grant execute on function public.get_party_ledger_summary() to authenticated;

grant execute on function public.get_company_cash_ledger_page(text, text, text, date, date, int, int) to service_role;
grant execute on function public.get_gold_ledger_page(text, text, text, timestamptz, timestamptz, int, int) to service_role;
grant execute on function public.get_party_ledger_summary() to service_role;
