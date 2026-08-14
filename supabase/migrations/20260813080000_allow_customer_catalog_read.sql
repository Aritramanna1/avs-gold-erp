-- Allow authenticated customer role to read catalog designs.
begin;

drop policy if exists catalog_designs_customer_read_restrict on public.catalog_designs;

create policy catalog_designs_customer_read_restrict on public.catalog_designs as restrictive
  for select to authenticated
  using (true);

commit;
