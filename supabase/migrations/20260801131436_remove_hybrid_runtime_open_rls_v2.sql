-- Reconciled from production (project dqgrrafuoxaorvyrcuuh) on 2026-08-11 — this migration was applied directly to Supabase and had no local file until now.

do $$
declare r record;
begin
  for r in
    select c.relname as tbl
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and p.polname = 'hybrid_runtime_access'
  loop
    execute format('drop policy if exists hybrid_runtime_access on public.%I', r.tbl);
  end loop;
end $$;

do $$
declare t text;
begin
  foreach t in array array['dropdown_masters','erp_schema_meta','print_templates','document_sequences'] loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('drop policy if exists %I on public.%I', t || '_staff_read', t);
    execute format('create policy %I on public.%I for select to authenticated using (auth.uid() is not null and not public.is_customer_role())', t || '_staff_read', t);
    execute format('drop policy if exists %I on public.%I', t || '_staff_write', t);
    execute format('create policy %I on public.%I for all to authenticated using (auth.uid() is not null and not public.is_customer_role() and not public.has_role(auth.uid(), ''viewer''::public.app_role)) with check (auth.uid() is not null and not public.is_customer_role() and not public.has_role(auth.uid(), ''viewer''::public.app_role))', t || '_staff_write', t);
  end loop;
end $$;

do $$
begin
  if to_regclass('public.communication_logs') is not null then
    drop policy if exists communication_logs_staff_read on public.communication_logs;
    create policy communication_logs_staff_read on public.communication_logs for select to authenticated using (auth.uid() is not null and not public.is_customer_role());
    drop policy if exists communication_logs_staff_write on public.communication_logs;
    create policy communication_logs_staff_write on public.communication_logs for all to authenticated using (auth.uid() is not null and not public.is_customer_role() and not public.has_role(auth.uid(), 'viewer'::public.app_role)) with check (auth.uid() is not null and not public.is_customer_role() and not public.has_role(auth.uid(), 'viewer'::public.app_role));
  end if;
end $$;

do $$
declare t text;
  branch_read text := '(branch_id in (select b.id from public.branches b where b.firm_id = public.my_firm_id()) or public.has_role(auth.uid(), ''saas_admin''::public.app_role))';
  branch_write text := '(branch_id in (select b.id from public.branches b where b.firm_id = public.my_firm_id()) and not public.has_role(auth.uid(), ''viewer''::public.app_role))';
begin
  foreach t in array array['comm_provider_settings','hallmark_batches','physical_stock_counts','stock_lots','stock_stones'] loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('drop policy if exists %I on public.%I', t || '_branch_read', t);
    execute format('create policy %I on public.%I for select to authenticated using (%s)', t || '_branch_read', t, branch_read);
    execute format('drop policy if exists %I on public.%I', t || '_branch_write', t);
    execute format('create policy %I on public.%I for all to authenticated using (%s) with check (%s)', t || '_branch_write', t, branch_write, branch_write);
  end loop;
end $$;
