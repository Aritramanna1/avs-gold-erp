-- Billing outstanding summary for the web register.
-- Security model: SECURITY INVOKER so public.invoices RLS remains authoritative.

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
language sql
security invoker
stable
set search_path = public
as $$
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
    where i.status <> 'cancelled'
      and i.balance_paise > 0
      and (p_branch_id is null or i.data->>'branchId' = p_branch_id)
  )
  select
    coalesce(open_invoices.customer_id, 'walk_in') as customer_id,
    max(open_invoices.customer_name) as customer_name,
    max(open_invoices.phone) as phone,
    sum(open_invoices.balance_paise)::bigint as amount_paise,
    min(open_invoices.created_at) as oldest_created_at,
    max(open_invoices.id) filter (where open_invoices.rn = 1) as latest_invoice_id,
    max(open_invoices.invoice_no) filter (where open_invoices.rn = 1) as latest_invoice_no
  from open_invoices
  group by coalesce(open_invoices.customer_id, 'walk_in')
  order by sum(open_invoices.balance_paise) desc;
$$;

revoke all on function public.get_billing_outstanding_summary(text) from public;
grant execute on function public.get_billing_outstanding_summary(text) to authenticated;
