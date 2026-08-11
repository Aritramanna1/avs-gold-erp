-- Reconciled from production (project dqgrrafuoxaorvyrcuuh) on 2026-08-11 — this migration was applied directly to Supabase and had no local file until now.

begin;

update public.invoices i
set
  customer_id = coalesce(i.customer_id, i.data->>'customerId'),
  firm_id = coalesce(i.firm_id, (i.data->>'firmId')::uuid)
where i.customer_id is null
   or i.firm_id is null;

update public.invoices i
set firm_id = b.firm_id
from public.branches b
where i.firm_id is null
  and coalesce(i.data->>'branchId', '') = b.id
  and b.firm_id is not null;

update public.branches b
set firm_id = up.firm_id
from public.user_profiles up
where b.firm_id is null
  and up.branch_id = b.id
  and up.firm_id is not null;

create or replace function public.is_customer_role()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.user_profiles up
    where up.auth_id = auth.uid()
      and up.active
      and up.status = 'active'
      and (
        lower(coalesce(up.role, '')) = 'customer'
        or (
          up.customer_person_id is not null
          and lower(coalesce(up.role, '')) in ('viewer', 'customer portal', 'customer_portal')
        )
      )
  );
$$;

create or replace function public.my_customer_person_id()
returns text
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select up.customer_person_id
  from public.user_profiles up
  where up.auth_id = auth.uid()
    and up.active
    and up.status = 'active'
    and up.customer_person_id is not null
    and (
      lower(coalesce(up.role, '')) = 'customer'
      or lower(coalesce(up.role, '')) in ('viewer', 'customer portal', 'customer_portal')
    )
  limit 1;
$$;

drop policy if exists invoices_read_authed on public.invoices;

create policy invoices_firm_read on public.invoices
  for select to authenticated
  using (
    public.is_saas_admin()
    or firm_id = public.my_firm_id()
  );

drop policy if exists branches_select on public.branches;

create policy branches_select on public.branches
  for select to authenticated
  using (
    public.is_saas_admin()
    or (
      public.my_firm_id() is not null
      and firm_id = public.my_firm_id()
    )
  );

commit;
