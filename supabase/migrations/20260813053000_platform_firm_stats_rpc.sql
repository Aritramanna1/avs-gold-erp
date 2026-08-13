-- Platform owner aggregate stats for tenant firms.
--
-- This is Supabase-online only. It replaces broad client-side platform summary
-- hydration with one audited aggregate endpoint.

create or replace function public.get_platform_firm_stats()
returns table (
  firm_id uuid,
  invoices bigint,
  invoice_value_minor bigint,
  orders bigint,
  open_orders bigint,
  job_cards bigint,
  users bigint,
  platform_bills bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with invoice_stats as (
    select
      i.firm_id,
      count(*)::bigint as invoices,
      coalesce(sum(coalesce(i.grand_total_paise, 0)), 0)::bigint as invoice_value_minor
    from public.invoices i
    group by i.firm_id
  ),
  order_stats as (
    select
      o.firm_id,
      count(*)::bigint as orders,
      count(*) filter (
        where lower(coalesce(o.status, '')) not in ('completed', 'cancelled', 'delivered', 'closed')
      )::bigint as open_orders
    from public.orders o
    group by o.firm_id
  ),
  job_stats as (
    select jc.firm_id, count(*)::bigint as job_cards
    from public.job_cards jc
    group by jc.firm_id
  ),
  user_stats as (
    select up.firm_id, count(*)::bigint as users
    from public.user_profiles up
    group by up.firm_id
  ),
  bill_stats as (
    select pbd.firm_id, count(*)::bigint as platform_bills
    from public.platform_billing_documents pbd
    group by pbd.firm_id
  )
  select
    o.id as firm_id,
    coalesce(i.invoices, 0)::bigint as invoices,
    coalesce(i.invoice_value_minor, 0)::bigint as invoice_value_minor,
    coalesce(os.orders, 0)::bigint as orders,
    coalesce(os.open_orders, 0)::bigint as open_orders,
    coalesce(js.job_cards, 0)::bigint as job_cards,
    coalesce(us.users, 0)::bigint as users,
    coalesce(bs.platform_bills, 0)::bigint as platform_bills
  from public.organizations o
  left join invoice_stats i on i.firm_id = o.id
  left join order_stats os on os.firm_id = o.id
  left join job_stats js on js.firm_id = o.id
  left join user_stats us on us.firm_id = o.id
  left join bill_stats bs on bs.firm_id = o.id
  where public.is_saas_admin();
$$;

revoke all on function public.get_platform_firm_stats() from public, anon;
grant execute on function public.get_platform_firm_stats() to authenticated, service_role;
