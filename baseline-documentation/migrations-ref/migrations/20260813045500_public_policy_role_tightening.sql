-- Tighten older tenant policies from PUBLIC to authenticated. The predicates
-- remain tenant-scoped; this removes anonymous sessions from the policy target.

drop policy if exists "Firm members manage composition formulas" on public.metal_composition_formulas;
create policy "Firm members manage composition formulas"
on public.metal_composition_formulas
for all
to authenticated
using (firm_id = public.my_firm_id())
with check (firm_id = public.my_firm_id());

drop policy if exists "Firm members manage metal purities" on public.precious_metal_purities;
create policy "Firm members manage metal purities"
on public.precious_metal_purities
for all
to authenticated
using (firm_id = public.my_firm_id())
with check (firm_id = public.my_firm_id());

drop policy if exists "Firm members manage precious metals" on public.precious_metals;
create policy "Firm members manage precious metals"
on public.precious_metals
for all
to authenticated
using (firm_id = public.my_firm_id())
with check (firm_id = public.my_firm_id());

drop policy if exists supplier_purchases_select on public.supplier_purchases;
create policy supplier_purchases_select
on public.supplier_purchases
for select
to authenticated
using (firm_id = public.my_firm_id());

drop policy if exists supplier_purchases_insert on public.supplier_purchases;
create policy supplier_purchases_insert
on public.supplier_purchases
for insert
to authenticated
with check (firm_id = public.my_firm_id());

drop policy if exists supplier_purchases_update on public.supplier_purchases;
create policy supplier_purchases_update
on public.supplier_purchases
for update
to authenticated
using (firm_id = public.my_firm_id())
with check (firm_id = public.my_firm_id());

drop policy if exists supplier_purchases_delete on public.supplier_purchases;
create policy supplier_purchases_delete
on public.supplier_purchases
for delete
to authenticated
using (firm_id = public.my_firm_id());
