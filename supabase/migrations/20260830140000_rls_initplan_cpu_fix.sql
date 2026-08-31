-- CPU fix: RLS helpers (my_firm_id, tenant_module_write_allowed) were evaluated
-- per row because policies called them without scalar subselects. Evidence:
-- user_profiles 43M seq scans (34 rows), organization_features 6.5M seq scans.
-- Wrap stable helpers in (select ...) so Postgres initplans them once per query.

create index if not exists idx_user_profiles_auth_active
  on public.user_profiles (auth_id)
  where active and status = 'active';

create index if not exists idx_organization_features_org_key
  on public.organization_features (organization_id, feature_key);

create or replace function public.organization_feature_enabled(p_feature_key text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select coalesce(
    (
      select of.enabled
      from public.organization_features of
      where of.organization_id = (select public.my_firm_id())
        and of.feature_key = p_feature_key
    ),
    true
  );
$$;

create or replace function public.tenant_module_write_allowed(p_feature_key text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select (select public.is_saas_admin())
    or (select public.organization_feature_enabled(p_feature_key));
$$;

-- Initplan firm scope: constants evaluated once; firm_id comparison stays per row.
do $$
declare
  pol text;
  t text;
  tables text[] := array[
    'rate_cut_records','whatsapp_inbox','daily_close','print_logs','salary_rules',
    'worker_transactions','dropdown_masters','app_settings','crm_tasks_meetings',
    'inventory','stock_movements','people','gold_settlements','crm_interactions',
    'melt_jobs','branch_settings','invitations','repairs','job_process_steps',
    'customer_ledger','communication_logs','job_cards','attendance',
    'manufacturing_bills','attachments','payments','catalog_designs',
    'document_sequences','worker_settlements','orders','crm_leads_opportunities'
  ];
  same_firm text := '(
    firm_id = (select public.my_firm_id())
    or (firm_id is null and (select public.my_firm_id()) is null)
    or (select public.is_saas_admin())
  )';
begin
  foreach t in array tables loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = t and column_name = 'firm_id'
    ) then
      continue;
    end if;

    for pol in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy if exists %I on public.%I', pol, t);
    end loop;

    execute format(
      'create policy %I on public.%I for select to authenticated
       using ((select auth.uid()) is not null and %s)',
      t || '_read_authed', t, same_firm
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated
       with check (
         (select auth.uid()) is not null
         and not (select public.has_role((select auth.uid()), ''viewer''::public.app_role))
         and %s
       )',
      t || '_insert_staff', t, same_firm
    );
    execute format(
      'create policy %I on public.%I for update to authenticated
       using (
         (select auth.uid()) is not null
         and not (select public.has_role((select auth.uid()), ''viewer''::public.app_role))
         and %s
       )
       with check (
         (select auth.uid()) is not null
         and not (select public.has_role((select auth.uid()), ''viewer''::public.app_role))
         and %s
       )',
      t || '_update_staff', t, same_firm, same_firm
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated
       using (
         (select auth.uid()) is not null
         and not (select public.has_role((select auth.uid()), ''viewer''::public.app_role))
         and %s
       )',
      t || '_delete_staff', t, same_firm
    );
  end loop;
end $$;

-- gold_ledger: firm scope + bullion module gate (initplan wrapped).
do $$
declare pol text;
  same_firm text := '(
    firm_id = (select public.my_firm_id())
    or (firm_id is null and (select public.my_firm_id()) is null)
    or (select public.is_saas_admin())
  )';
begin
  if to_regclass('public.gold_ledger') is null then return; end if;
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'gold_ledger'
  loop execute format('drop policy if exists %I on public.gold_ledger', pol); end loop;

  execute format(
    'create policy gold_ledger_read on public.gold_ledger for select to authenticated
     using (
       (select auth.uid()) is not null
       and (select public.tenant_module_write_allowed(''bullion''))
       and %s
     )', same_firm
  );
  execute format(
    'create policy gold_ledger_insert on public.gold_ledger for insert to authenticated
     with check (
       (select auth.uid()) is not null
       and not (select public.has_role((select auth.uid()), ''viewer''::public.app_role))
       and (select public.tenant_module_write_allowed(''bullion''))
       and %s
     )', same_firm
  );
  execute format(
    'create policy gold_ledger_update on public.gold_ledger for update to authenticated
     using (
       (select auth.uid()) is not null
       and not (select public.has_role((select auth.uid()), ''viewer''::public.app_role))
       and (select public.tenant_module_write_allowed(''bullion''))
       and %s
     )
     with check (
       (select auth.uid()) is not null
       and (select public.tenant_module_write_allowed(''bullion''))
       and %s
     )', same_firm, same_firm
  );
  execute format(
    'create policy gold_ledger_delete on public.gold_ledger for delete to authenticated
     using (
       (select auth.uid()) is not null
       and not (select public.has_role((select auth.uid()), ''viewer''::public.app_role))
       and (select public.tenant_module_write_allowed(''bullion''))
       and %s
     )', same_firm
  );
end $$;

-- invoices: billing module gate preserved; add firm scope with initplan.
do $$
declare pol text;
  same_firm text := '(
    firm_id = (select public.my_firm_id())
    or (firm_id is null and (select public.my_firm_id()) is null)
    or (select public.is_saas_admin())
  )';
begin
  if to_regclass('public.invoices') is null then return; end if;
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'invoices'
  loop execute format('drop policy if exists %I on public.invoices', pol); end loop;

  execute format(
    'create policy invoices_read_authed on public.invoices for select to authenticated
     using (
       (select auth.uid()) is not null
       and (select public.tenant_module_write_allowed(''billing''))
       and %s
     )', same_firm
  );
  execute format(
    'create policy invoices_insert_staff on public.invoices for insert to authenticated
     with check (
       (select auth.uid()) is not null
       and not (select public.has_role((select auth.uid()), ''viewer''::public.app_role))
       and (select public.tenant_module_write_allowed(''billing''))
       and %s
     )', same_firm
  );
  execute format(
    'create policy invoices_update_staff on public.invoices for update to authenticated
     using (
       (select auth.uid()) is not null
       and not (select public.has_role((select auth.uid()), ''viewer''::public.app_role))
       and (select public.tenant_module_write_allowed(''billing''))
       and %s
     )
     with check (
       (select auth.uid()) is not null
       and not (select public.has_role((select auth.uid()), ''viewer''::public.app_role))
       and (select public.tenant_module_write_allowed(''billing''))
       and %s
     )', same_firm, same_firm
  );
  execute format(
    'create policy invoices_delete_staff on public.invoices for delete to authenticated
     using (
       (select auth.uid()) is not null
       and not (select public.has_role((select auth.uid()), ''viewer''::public.app_role))
       and (select public.tenant_module_write_allowed(''billing''))
       and %s
     )', same_firm
  );
end $$;

-- Firm-scoped dashboard aggregates (index-friendly, same business output).
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
  with firm as (
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
    from public.gold_ledger gl, firm f
    where gl.firm_id = f.firm_id
  ),
  today_invoices as (
    select i.*
    from public.invoices i, firm f
    where i.firm_id = f.firm_id
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
  )
  select
    l.vault_mg,
    l.karigar_mg,
    l.finished_mg,
    l.customer_mg,
    l.jeweller_mg,
    l.scrap_mg,
    (l.total_mg - (l.vault_mg + l.karigar_mg + l.finished_mg + l.customer_mg + l.jeweller_mg + l.scrap_mg))::bigint,
    (select count(*)::bigint from public.orders o, firm f where o.firm_id = f.firm_id and o.status not in ('delivered', 'cancelled')),
    (select count(*)::bigint from public.orders o, firm f where o.firm_id = f.firm_id),
    (select count(*)::bigint from public.inventory inv, firm f where inv.firm_id = f.firm_id and inv.status = 'available'),
    coalesce((select sum(ti.grand_total_paise)::bigint from today_invoices ti), 0)::bigint,
    (select count(*)::bigint from today_invoices),
    (select count(*)::bigint from public.invoices i, firm f where i.firm_id = f.firm_id),
    pt.cash_paise,
    pt.upi_paise,
    pt.card_paise,
    pt.gold_paid_paise,
    coalesce((select sum(greatest(ti.balance_paise, 0))::bigint from today_invoices ti), 0)::bigint,
    it.gold_sold_mg
  from ledger l
  cross join payment_totals pt
  cross join item_totals it;
$$;

revoke all on function public.get_home_dashboard_summary() from public, anon;
grant execute on function public.get_home_dashboard_summary() to authenticated, service_role;
