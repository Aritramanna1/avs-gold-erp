-- Reconciled from production (project dqgrrafuoxaorvyrcuuh) on 2026-08-11 — this migration was applied directly to Supabase and had no local file until now.

do $$
declare pol text;
begin
  if to_regclass('public.invoices') is null then return; end if;
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'invoices'
  loop execute format('drop policy if exists %I on public.invoices', pol); end loop;
  execute 'create policy invoices_read_authed on public.invoices for select to authenticated using (auth.uid() is not null and public.tenant_module_write_allowed(''billing''))';
  execute 'create policy invoices_insert_staff on public.invoices for insert to authenticated with check (auth.uid() is not null and not public.has_role(auth.uid(), ''viewer''::public.app_role) and public.tenant_module_write_allowed(''billing''))';
  execute 'create policy invoices_update_staff on public.invoices for update to authenticated using (auth.uid() is not null and not public.has_role(auth.uid(), ''viewer''::public.app_role) and public.tenant_module_write_allowed(''billing'')) with check (auth.uid() is not null and not public.has_role(auth.uid(), ''viewer''::public.app_role) and public.tenant_module_write_allowed(''billing''))';
  execute 'create policy invoices_delete_staff on public.invoices for delete to authenticated using (auth.uid() is not null and not public.has_role(auth.uid(), ''viewer''::public.app_role) and public.tenant_module_write_allowed(''billing''))';
end $$;
