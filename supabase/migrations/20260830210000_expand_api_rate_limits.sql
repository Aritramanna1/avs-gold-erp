-- Expand server-side rate limits to billing, cash ledger, and CEO report RPCs.

begin;

-- Billing outstanding summary (added firm_id filter + rate limit)
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
stable
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

-- Company cash ledger page
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

-- CEO branch KPIs (preserve returns-table shape + rate limit)
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
stable
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
