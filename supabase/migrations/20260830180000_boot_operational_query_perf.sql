-- Boot operational query performance: firm-scoped partial indexes + dashboard RPC hardening.
-- Root cause: unscoped or cross-join COUNT/aggregate paths timed out (57014) under load.

begin;

-- Open-order dashboard counts and bucket queries (firm + status filter).
create index if not exists idx_orders_firm_open_updated
  on public.orders (firm_id, updated_at desc)
  where status not in ('delivered', 'cancelled');

-- Worker transaction pulls filter by firm + kind + recency.
create index if not exists idx_worker_transactions_firm_kind_ts
  on public.worker_transactions (firm_id, kind, ts desc);

-- Dashboard aggregates: single initplan firm_id, index-friendly counts, bounded ledger scan.
create or replace function public.get_home_dashboard_summary()
returns table(
  vault_gold_mg bigint,
  karigar_gold_mg bigint,
  finished_gold_mg bigint,
  customer_gold_mg bigint,
  jeweller_gold_mg bigint,
  scrap_gold_mg bigint,
  ledger_discrepancy_mg bigint,
  open_orders bigint,
  total_orders bigint,
  available_stock_count bigint,
  today_billing_paise bigint,
  today_invoice_count bigint,
  total_invoice_count bigint,
  today_cash_paise bigint,
  today_upi_paise bigint,
  today_card_paise bigint,
  today_gold_paid_paise bigint,
  today_outstanding_paise bigint,
  today_gold_sold_mg bigint
)
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  with scope as (
    select (select public.my_firm_id()) as firm_id
  ),
  ledger as (
    select
      coalesce(sum((gl.bucket_deltas->>'vault')::bigint), 0)::bigint as vault_mg,
      coalesce(sum((gl.bucket_deltas->>'karigar')::bigint), 0)::bigint as karigar_mg,
      coalesce(sum((gl.bucket_deltas->>'finished')::bigint), 0)::bigint as finished_mg,
      coalesce(sum((gl.bucket_deltas->>'customer')::bigint), 0)::bigint as customer_mg,
      coalesce(sum((gl.bucket_deltas->>'jeweller')::bigint), 0)::bigint as jeweller_mg,
      coalesce(sum((gl.bucket_deltas->>'scrap')::bigint), 0)::bigint as scrap_mg,
      coalesce(sum(gl.net_fine_mg), 0)::bigint as total_mg
    from public.gold_ledger gl
    cross join scope s
    where gl.firm_id = s.firm_id
  ),
  order_counts as (
    select
      count(*) filter (
        where o.status not in ('delivered', 'cancelled')
      )::bigint as open_cnt,
      count(*)::bigint as total_cnt
    from public.orders o
    cross join scope s
    where o.firm_id = s.firm_id
  ),
  today_invoices as (
    select i.*
    from public.invoices i
    cross join scope s
    where i.firm_id = s.firm_id
      and i.created_at >= current_date
      and i.created_at < current_date + interval '1 day'
  ),
  payment_totals as (
    select
      coalesce(sum(case when payment->>'mode' = 'cash' then (payment->>'amountPaise')::bigint else 0 end), 0)::bigint as cash_paise,
      coalesce(sum(case when payment->>'mode' = 'upi' then (payment->>'amountPaise')::bigint else 0 end), 0)::bigint as upi_paise,
      coalesce(sum(case when payment->>'mode' = 'card' then (payment->>'amountPaise')::bigint else 0 end), 0)::bigint as card_paise,
      coalesce(sum(case when payment->>'mode' in ('gold_exchange', 'customer_gold_credit') then (payment->>'amountPaise')::bigint else 0 end), 0)::bigint as gold_paid_paise
    from today_invoices ti
    cross join lateral jsonb_array_elements(coalesce(ti.data->'payments', '[]'::jsonb)) payment
  ),
  item_totals as (
    select coalesce(sum((item->>'fineMg')::bigint), 0)::bigint as gold_sold_mg
    from today_invoices ti
    cross join lateral jsonb_array_elements(coalesce(ti.data->'items', '[]'::jsonb)) item
  ),
  stock_counts as (
    select count(*)::bigint as available_cnt
    from public.inventory inv
    cross join scope s
    where inv.firm_id = s.firm_id
      and inv.status = 'available'
  ),
  invoice_totals as (
    select count(*)::bigint as total_cnt
    from public.invoices i
    cross join scope s
    where i.firm_id = s.firm_id
  )
  select
    l.vault_mg,
    l.karigar_mg,
    l.finished_mg,
    l.customer_mg,
    l.jeweller_mg,
    l.scrap_mg,
    (l.total_mg - (l.vault_mg + l.karigar_mg + l.finished_mg + l.customer_mg + l.jeweller_mg + l.scrap_mg))::bigint,
    oc.open_cnt,
    oc.total_cnt,
    sc.available_cnt,
    coalesce((select sum(ti.grand_total_paise)::bigint from today_invoices ti), 0)::bigint,
    (select count(*)::bigint from today_invoices),
    it.total_cnt,
    pt.cash_paise,
    pt.upi_paise,
    pt.card_paise,
    pt.gold_paid_paise,
    coalesce((select sum(greatest(ti.balance_paise, 0))::bigint from today_invoices ti), 0)::bigint,
    itt.gold_sold_mg
  from ledger l
  cross join order_counts oc
  cross join stock_counts sc
  cross join invoice_totals it
  cross join payment_totals pt
  cross join item_totals itt;
$$;

revoke all on function public.get_home_dashboard_summary() from public, anon;
grant execute on function public.get_home_dashboard_summary() to authenticated, service_role;

commit;
