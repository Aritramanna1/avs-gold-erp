-- Home dashboard aggregate.
-- SECURITY INVOKER is intentional: all counts/sums respect current caller RLS.

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
set search_path = public
as $$
  with ledger as (
    select
      coalesce(sum((bucket_deltas->>'vault')::bigint), 0)::bigint as vault_mg,
      coalesce(sum((bucket_deltas->>'karigar')::bigint), 0)::bigint as karigar_mg,
      coalesce(sum((bucket_deltas->>'finished')::bigint), 0)::bigint as finished_mg,
      coalesce(sum((bucket_deltas->>'customer')::bigint), 0)::bigint as customer_mg,
      coalesce(sum((bucket_deltas->>'jeweller')::bigint), 0)::bigint as jeweller_mg,
      coalesce(sum((bucket_deltas->>'scrap')::bigint), 0)::bigint as scrap_mg,
      coalesce(sum(net_fine_mg), 0)::bigint as total_mg
    from public.gold_ledger
  ),
  today_invoices as (
    select *
    from public.invoices
    where created_at >= current_date
      and created_at < current_date + interval '1 day'
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
  )
  select
    l.vault_mg,
    l.karigar_mg,
    l.finished_mg,
    l.customer_mg,
    l.jeweller_mg,
    l.scrap_mg,
    (l.total_mg - (l.vault_mg + l.karigar_mg + l.finished_mg + l.customer_mg + l.jeweller_mg + l.scrap_mg))::bigint,
    (select count(*)::bigint from public.orders where status not in ('delivered', 'cancelled')),
    (select count(*)::bigint from public.orders),
    (select count(*)::bigint from public.inventory where status = 'available'),
    coalesce((select sum(grand_total_paise)::bigint from today_invoices), 0)::bigint,
    (select count(*)::bigint from today_invoices),
    (select count(*)::bigint from public.invoices),
    pt.cash_paise,
    pt.upi_paise,
    pt.card_paise,
    pt.gold_paid_paise,
    coalesce((select sum(greatest(balance_paise, 0))::bigint from today_invoices), 0)::bigint,
    it.gold_sold_mg
  from ledger l
  cross join payment_totals pt
  cross join item_totals it;
$$;

revoke all on function public.get_home_dashboard_summary() from public, anon;
grant execute on function public.get_home_dashboard_summary() to authenticated, service_role;
