-- Reconciled from production (project dqgrrafuoxaorvyrcuuh) on 2026-08-11 — this migration was applied directly to Supabase and had no local file until now.

-- QA vendor for supplier purchase E2E (firm f9f73cce-9538-4286-9754-530ca4581fbb)
-- Reverse supplier purchase RPC

create or replace function public.reverse_supplier_purchase(p_purchase_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_firm uuid;
  v_row record;
  v_ledger_entries jsonb := '[]'::jsonb;
  v_result jsonb;
begin
  if p_purchase_id is null then
    raise exception 'purchase id is required' using errcode = '22023';
  end if;

  v_firm := public.my_firm_id();
  if v_firm is null and not public.has_role(auth.uid(), 'saas_admin'::public.app_role) then
    raise exception 'firm context required' using errcode = '42501';
  end if;

  if not public.tenant_module_write_allowed('supplier_management') then
    raise exception 'Supplier Management module is not enabled' using errcode = '42501';
  end if;

  select * into v_row
  from public.supplier_purchases sp
  where sp.id = p_purchase_id
    and sp.firm_id = v_firm;

  if not found then
    raise exception 'Supplier purchase not found' using errcode = 'P0002';
  end if;

  if coalesce((v_row.data->>'reversedAt')::bigint, 0) > 0 then
    raise exception 'Purchase already reversed' using errcode = '23505';
  end if;

  if lower(coalesce(v_row.metal, 'Gold')) = 'gold' then
    v_ledger_entries := v_ledger_entries || jsonb_build_array(
      jsonb_build_object(
        'id', gen_random_uuid()::text,
        'type', 'purchase_reversal',
        'netFineMg', -v_row.fine_mg,
        'deltas', jsonb_build_object('vault', -v_row.fine_mg),
        'grossMg', v_row.gross_mg,
        'purity', v_row.purity_permille,
        'fineMg', v_row.fine_mg,
        'notes', v_row.purchase_no || ' · reversed',
        'reference', p_purchase_id::text
      )
    );
    if coalesce(v_row.gold_paid_fine_mg, 0) > 0 then
      v_ledger_entries := v_ledger_entries || jsonb_build_array(
        jsonb_build_object(
          'id', gen_random_uuid()::text,
          'type', 'purchase_reversal',
          'netFineMg', v_row.gold_paid_fine_mg,
          'deltas', jsonb_build_object('vault', v_row.gold_paid_fine_mg),
          'fineMg', v_row.gold_paid_fine_mg,
          'purity', v_row.purity_permille,
          'notes', v_row.purchase_no || ' · reversal of gold payment',
          'reference', p_purchase_id::text
        )
      );
    end if;
    v_result := public.post_gold_ledger_entries(v_ledger_entries);
  end if;

  update public.supplier_purchases
  set data = coalesce(data, '{}'::jsonb) || jsonb_build_object('reversedAt', (extract(epoch from now()) * 1000)::bigint)
  where id = p_purchase_id;

  return jsonb_build_object('id', p_purchase_id, 'reversed', true);
end;
$$;

revoke all on function public.reverse_supplier_purchase(uuid) from public, anon;
grant execute on function public.reverse_supplier_purchase(uuid) to authenticated;

insert into public.people (id, firm_id, type, full_name, phone, active, data)
select
  'qa-vendor-mtj-20260802',
  'f9f73cce-9538-4286-9754-530ca4581fbb'::uuid,
  'vendor',
  'QA Bullion Supplier',
  '9999900001',
  true,
  jsonb_build_object('notes', 'E2E supplier purchase vendor')
where not exists (
  select 1 from public.people p
  where p.firm_id = 'f9f73cce-9538-4286-9754-530ca4581fbb'::uuid
    and p.type = 'vendor'
    and p.full_name = 'QA Bullion Supplier'
);
