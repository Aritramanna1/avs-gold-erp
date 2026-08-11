-- Reconciled from production (project dqgrrafuoxaorvyrcuuh) on 2026-08-11 — this migration was applied directly to Supabase and had no local file until now.

-- Customer portal data isolation: customers see only their linked person row and
-- related invoices/orders/repairs/ledger/KYC; no ERP writes. Staff firm-scoped
-- policies remain unchanged — RESTRICTIVE policies AND with existing permissive
-- rules so USING(true) leftovers cannot leak cross-customer rows.

begin;

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
      and lower(coalesce(up.role, '')) = 'customer'
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
    and lower(coalesce(up.role, '')) = 'customer'
    and up.customer_person_id is not null
  limit 1;
$$;

revoke all on function public.is_customer_role() from public, anon;
revoke all on function public.my_customer_person_id() from public, anon;
grant execute on function public.is_customer_role() to authenticated, service_role;
grant execute on function public.my_customer_person_id() to authenticated, service_role;

do $$
declare
  t text;
  col text;
  read_expr text;
  erp_tables text[] := array[
    'rate_cut_records','gold_ledger','whatsapp_inbox','daily_close','print_logs','salary_rules',
    'worker_transactions','jeweller_transactions','whatsapp_templates','dropdown_masters','app_settings',
    'crm_tasks_meetings','inventory','kyc_documents','stock_movements','people','gold_settlements',
    'crm_interactions','melt_jobs','branch_settings','invitations','repairs','job_process_steps',
    'customer_ledger','communication_logs','job_cards','attendance','manufacturing_bills',
    'attachments','invoices','payments','catalog_designs','document_sequences','worker_settlements',
    'orders','crm_leads_opportunities','branches','workshops','estimates','delivery_challans',
    'credit_notes','debit_notes','metal_conversions','supplier_purchases','customer_settlements',
    'outside_work_transactions','hallmark_jobs','stone_diamond_items','lot_batches'
  ];
  customer_col_map jsonb := '{
    "people": "id",
    "kyc_documents": "person_id",
    "invoices": "customer_id",
    "orders": "customer_id",
    "repairs": "customer_id",
    "customer_ledger": "customer_id"
  }'::jsonb;
begin
  foreach t in array erp_tables loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;

    col := customer_col_map ->> t;
    if col is not null then
      read_expr := format(
        '(not public.is_customer_role() or %I = public.my_customer_person_id())',
        col
      );
    else
      read_expr := '(not public.is_customer_role())';
    end if;

    execute format('drop policy if exists %I on public.%I', t || '_customer_read_restrict', t);
    execute format(
      'create policy %I on public.%I as restrictive for select to authenticated using (%s)',
      t || '_customer_read_restrict',
      t,
      read_expr
    );

    execute format('drop policy if exists %I on public.%I', t || '_customer_insert_restrict', t);
    execute format(
      'create policy %I on public.%I as restrictive for insert to authenticated with check (not public.is_customer_role())',
      t || '_customer_insert_restrict',
      t
    );

    execute format('drop policy if exists %I on public.%I', t || '_customer_update_restrict', t);
    execute format(
      'create policy %I on public.%I as restrictive for update to authenticated using (not public.is_customer_role()) with check (not public.is_customer_role())',
      t || '_customer_update_restrict',
      t
    );

    execute format('drop policy if exists %I on public.%I', t || '_customer_delete_restrict', t);
    execute format(
      'create policy %I on public.%I as restrictive for delete to authenticated using (not public.is_customer_role())',
      t || '_customer_delete_restrict',
      t
    );
  end loop;
end $$;

-- Payments link to invoices — scope by invoice.customer_id, not a direct customer_id column.
do $$
begin
  if to_regclass('public.payments') is not null then
    drop policy if exists payments_customer_read_restrict on public.payments;
    create policy payments_customer_read_restrict on public.payments as restrictive
      for select to authenticated
      using (
        not public.is_customer_role()
        or exists (
          select 1
          from public.invoices i
          where i.id = payments.invoice_id
            and i.customer_id = public.my_customer_person_id()
        )
      );
  end if;
end $$;

commit;
