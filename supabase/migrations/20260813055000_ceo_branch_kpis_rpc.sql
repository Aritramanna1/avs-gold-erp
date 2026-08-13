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
language sql
stable
set search_path = public
as $$
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
    where coalesce(i.branch_id, i.data->>'branchId', 'MAIN') = coalesce(p.branch_id, 'MAIN')
      and i.created_at >= p.month_start
      and coalesce(i.status, i.data->>'status', '') <> 'cancelled'
  ),
  outstanding_invoices as (
    select coalesce(sum(greatest(coalesce(i.balance_paise, 0), 0)), 0)::bigint as outstanding_paise
    from public.invoices i, params p
    where coalesce(i.branch_id, i.data->>'branchId', 'MAIN') = coalesce(p.branch_id, 'MAIN')
      and coalesce(i.status, i.data->>'status', '') <> 'cancelled'
      and coalesce(i.balance_paise, 0) > 0
  ),
  order_counts as (
    select count(*)::bigint as pending_orders
    from public.orders o, params p
    where coalesce(o.branch_id, o.data->>'branchId', 'MAIN') = coalesce(p.branch_id, 'MAIN')
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
    where coalesce(j.branch_id, j.data->>'branchId', 'MAIN') = coalesce(p.branch_id, 'MAIN')
      and coalesce(j.status, j.data->>'status', '') not in ('closed', 'completed', 'cancelled', 'delivered')
  ),
  repair_counts as (
    select count(*)::bigint as pending_repairs
    from public.repairs r, params p
    where coalesce(r.branch_id, r.data->>'branchId', 'MAIN') = coalesce(p.branch_id, 'MAIN')
      and coalesce(r.status, r.data->>'status', '') not in ('delivered', 'cancelled')
  ),
  customer_counts as (
    select count(*)::bigint as total_customers
    from public.people pe, params p
    where coalesce(pe.branch_id, pe.data->>'branchId', 'MAIN') = coalesce(p.branch_id, 'MAIN')
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
$$;

revoke all on function public.get_ceo_branch_kpis(text) from public, anon;
grant execute on function public.get_ceo_branch_kpis(text) to authenticated, service_role;
