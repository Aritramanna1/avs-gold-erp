-- Reconciled from production (project dqgrrafuoxaorvyrcuuh) on 2026-08-11 — this migration was applied directly to Supabase and had no local file until now.

do $$
declare pol text;
begin
  if to_regclass('public.metal_conversions') is null then return; end if;
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'metal_conversions'
  loop execute format('drop policy if exists %I on public.metal_conversions', pol); end loop;
  execute 'create policy metal_conversions_read on public.metal_conversions for select to authenticated using (auth.uid() is not null and public.tenant_module_write_allowed(''melt_account''))';
  execute 'create policy metal_conversions_write on public.metal_conversions for all to authenticated using (auth.uid() is not null and public.tenant_module_write_allowed(''melt_account'')) with check (auth.uid() is not null and public.tenant_module_write_allowed(''melt_account''))';
end $$;
do $$
declare pol text; same_firm text := '(firm_id = public.my_firm_id() or (firm_id is null and public.my_firm_id() is null) or public.is_saas_admin())';
begin
  if to_regclass('public.gold_ledger') is null then return; end if;
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'gold_ledger'
  loop execute format('drop policy if exists %I on public.gold_ledger', pol); end loop;
  execute format('create policy gold_ledger_read on public.gold_ledger for select to authenticated using (auth.uid() is not null and public.tenant_module_write_allowed(''bullion'') and %s)', same_firm);
  execute format('create policy gold_ledger_insert on public.gold_ledger for insert to authenticated with check (auth.uid() is not null and not public.has_role(auth.uid(), ''viewer''::public.app_role) and public.tenant_module_write_allowed(''bullion'') and %s)', same_firm);
  execute format('create policy gold_ledger_update on public.gold_ledger for update to authenticated using (auth.uid() is not null and not public.has_role(auth.uid(), ''viewer''::public.app_role) and public.tenant_module_write_allowed(''bullion'') and %s) with check (auth.uid() is not null and public.tenant_module_write_allowed(''bullion'') and %s)', same_firm, same_firm);
  execute format('create policy gold_ledger_delete on public.gold_ledger for delete to authenticated using (auth.uid() is not null and not public.has_role(auth.uid(), ''viewer''::public.app_role) and public.tenant_module_write_allowed(''bullion'') and %s)', same_firm);
end $$;
