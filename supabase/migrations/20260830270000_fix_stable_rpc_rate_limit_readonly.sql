-- STABLE RPCs cannot call enforce_egress_rate_limit (writes + FOR UPDATE) inside
-- PostgREST read-only transactions → PostgreSQL 25006 / HTTP 405.
-- Same class of bug as get_authorization_context (20260830240000).
-- Fix: mark rate-limited read RPCs VOLATILE; rate limiter uses upsert (no FOR UPDATE).

begin;

create or replace function public.enforce_egress_rate_limit(
  p_bucket text,
  p_max_hits int,
  p_window_seconds int
)
returns void
language plpgsql
volatile
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

  insert into public.egress_rate_limit_buckets (user_id, bucket, window_start, hit_count)
  values (v_uid, p_bucket, v_now, 1)
  on conflict (user_id, bucket) do update
  set
    window_start = case
      when public.egress_rate_limit_buckets.window_start + make_interval(secs => p_window_seconds) <= v_now
        then v_now
      else public.egress_rate_limit_buckets.window_start
    end,
    hit_count = case
      when public.egress_rate_limit_buckets.window_start + make_interval(secs => p_window_seconds) <= v_now
        then 1
      else public.egress_rate_limit_buckets.hit_count + 1
    end
  returning window_start, hit_count into v_window, v_count;

  if v_window + make_interval(secs => p_window_seconds) > v_now and v_count > p_max_hits then
    raise exception 'rate limit exceeded (% per %s)', p_max_hits, p_window_seconds
      using errcode = 'P0001';
  end if;
end;
$$;

-- get_gold_ledger_page: STABLE → VOLATILE (rate limit writes)
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
volatile
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

-- get_firm_ledger_balances: STABLE → VOLATILE
create or replace function public.get_firm_ledger_balances(
  p_branch_id text default null,
  p_metal_code text default 'gold'
)
returns jsonb
language plpgsql
volatile
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

-- Remaining rate-limited RPCs from 20260830210000: STABLE → VOLATILE
create or replace function public.get_billing_outstanding_summary(p_branch_id text default null)
returns table (
  customer_id text,
  customer_name text,
  phone text,
  amount_paise bigint,
  oldest_created_at timestamptz,
  latest_invoice_id text,
  latest_invoice_no text
)
language plpgsql
security invoker
volatile
set search_path = pg_catalog, public
as $$
begin
  perform public.enforce_egress_rate_limit('rpc:billing_outstanding', 40, 60);
  return query
  with open_invoices as (
    select
      i.id,
      i.invoice_no,
      i.customer_id,
      coalesce(nullif(i.data->>'customerName', ''), 'Walk-in Customer') as customer_name,
      nullif(i.data->>'customerPhone', '') as phone,
      i.balance_paise,
      i.created_at,
      row_number() over (
        partition by i.customer_id
        order by i.created_at desc, i.invoice_no desc
      ) as rn
    from public.invoices i
    where i.firm_id = public.my_firm_id()
      and i.status <> 'cancelled'
      and i.balance_paise > 0
      and (p_branch_id is null or i.data->>'branchId' = p_branch_id)
  )
  select
    coalesce(open_invoices.customer_id, 'walk_in')::text,
    max(open_invoices.customer_name)::text,
    max(open_invoices.phone)::text,
    sum(open_invoices.balance_paise)::bigint,
    min(open_invoices.created_at),
    max(open_invoices.id) filter (where open_invoices.rn = 1)::text,
    max(open_invoices.invoice_no) filter (where open_invoices.rn = 1)::text
  from open_invoices
  group by coalesce(open_invoices.customer_id, 'walk_in')
  order by sum(open_invoices.balance_paise) desc;
end;
$$;

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
volatile
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_rows jsonb;
  v_total bigint;
begin
  perform public.enforce_egress_rate_limit('rpc:cash_ledger_page', 60, 60);

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

create or replace function public.get_ceo_branch_kpis(p_branch_id text)
returns table (
  sales_this_month_paise bigint,
  invoice_count bigint,
  outstanding_paise bigint,
  pending_orders bigint,
  active_job_cards bigint,
  ready_job_cards bigint,
  pending_repairs bigint,
  total_customers bigint
)
language plpgsql
volatile
security invoker
set search_path = pg_catalog, public
as $$
begin
  perform public.enforce_egress_rate_limit('rpc:ceo_branch_kpis', 30, 60);
  return query
  with params as (
    select
      nullif(p_branch_id, '') as branch_id,
      date_trunc('month', now()) as month_start
  ),
  month_invoices as (
    select
      coalesce(sum(coalesce(i.grand_total_paise, 0)), 0)::bigint as sales_this_month_paise,
      count(*)::bigint as invoice_count
    from public.invoices i, params p
    where i.firm_id = public.my_firm_id()
      and coalesce(i.data->>'branchId', 'MAIN') = coalesce(p.branch_id, 'MAIN')
      and i.created_at >= p.month_start
      and coalesce(i.status, i.data->>'status', '') <> 'cancelled'
  ),
  outstanding_invoices as (
    select coalesce(sum(greatest(coalesce(i.balance_paise, 0), 0)), 0)::bigint as outstanding_paise
    from public.invoices i, params p
    where i.firm_id = public.my_firm_id()
      and coalesce(i.data->>'branchId', 'MAIN') = coalesce(p.branch_id, 'MAIN')
      and coalesce(i.status, i.data->>'status', '') <> 'cancelled'
      and coalesce(i.balance_paise, 0) > 0
  ),
  order_counts as (
    select count(*)::bigint as pending_orders
    from public.orders o, params p
    where o.firm_id = public.my_firm_id()
      and coalesce(o.data->>'branchId', 'MAIN') = coalesce(p.branch_id, 'MAIN')
      and coalesce(o.status, o.data->>'status', '') in ('pending', 'in_progress', 'ready')
  ),
  job_counts as (
    select
      count(*) filter (
        where coalesce(j.status, j.data->>'status', '') in ('open', 'in_progress')
      )::bigint as active_job_cards,
      count(*) filter (
        where coalesce(j.status, j.data->>'status', '') in ('ready', 'ready_for_billing')
      )::bigint as ready_job_cards
    from public.job_cards j, params p
    where j.firm_id = public.my_firm_id()
      and coalesce(j.data->>'branchId', 'MAIN') = coalesce(p.branch_id, 'MAIN')
      and coalesce(j.status, j.data->>'status', '') not in ('closed', 'completed', 'cancelled', 'delivered')
  ),
  repair_counts as (
    select count(*)::bigint as pending_repairs
    from public.repairs r, params p
    where r.firm_id = public.my_firm_id()
      and coalesce(r.data->>'branchId', 'MAIN') = coalesce(p.branch_id, 'MAIN')
      and coalesce(r.status, r.data->>'status', '') not in ('delivered', 'cancelled')
  ),
  customer_counts as (
    select count(*)::bigint as total_customers
    from public.people pe, params p
    where pe.firm_id = public.my_firm_id()
      and coalesce(pe.data->>'branchId', 'MAIN') = coalesce(p.branch_id, 'MAIN')
      and coalesce(pe.type, pe.data->>'type', '') = 'customer'
  )
  select
    month_invoices.sales_this_month_paise,
    month_invoices.invoice_count,
    outstanding_invoices.outstanding_paise,
    order_counts.pending_orders,
    job_counts.active_job_cards,
    job_counts.ready_job_cards,
    repair_counts.pending_repairs,
    customer_counts.total_customers
  from month_invoices, outstanding_invoices, order_counts, job_counts, repair_counts, customer_counts;
end;
$$;

commit;
