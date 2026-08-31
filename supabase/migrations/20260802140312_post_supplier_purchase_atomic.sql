-- Reconciled from production (project dqgrrafuoxaorvyrcuuh) on 2026-08-11 — this migration was applied directly to Supabase and had no local file until now.

-- Atomic supplier purchase posting: purchase row + gold ledger + optional gold payment in one transaction.

create or replace function public.post_supplier_purchase(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_firm uuid;
  v_branch text;
  v_id uuid;
  v_supplier_id text;
  v_purchase_no text;
  v_metal text;
  v_fine_mg bigint;
  v_gross_mg bigint;
  v_gold_paid bigint;
  v_purity int;
  v_ledger_ref text;
  v_ledger_entries jsonb := '[]'::jsonb;
  v_result jsonb;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'p_payload must be a JSON object' using errcode = '22023';
  end if;

  v_firm := public.my_firm_id();
  if v_firm is null and not public.has_role(auth.uid(), 'saas_admin'::public.app_role) then
    raise exception 'firm context required' using errcode = '42501';
  end if;

  v_id := coalesce((p_payload->>'id')::uuid, gen_random_uuid());
  v_supplier_id := nullif(p_payload->>'supplierId', '');
  if v_supplier_id is null then
    raise exception 'supplier is required' using errcode = '23502';
  end if;

  if not exists (
    select 1 from public.people p
    where p.id = v_supplier_id
      and p.firm_id = v_firm
      and p.type = 'vendor'
  ) then
    raise exception 'Select a valid active supplier (vendor).' using errcode = '23503';
  end if;

  v_branch := coalesce(nullif(p_payload->>'branchId', ''), nullif(p_payload->>'branch_id', ''), 'MAIN');
  v_purchase_no := coalesce(nullif(p_payload->>'purchaseNo', ''), 'PUR-' || to_char(now(), 'YYYYMMDD') || '-' || substr(v_id::text, 1, 8));
  v_metal := coalesce(nullif(p_payload->>'metal', ''), 'Gold');
  v_gross_mg := coalesce((p_payload->>'grossMg')::bigint, 0);
  v_fine_mg := coalesce((p_payload->>'fineMg')::bigint, 0);
  v_gold_paid := coalesce((p_payload->>'goldPaidFineMg')::bigint, 0);
  v_purity := coalesce((p_payload->>'purityPermille')::int, 916);

  if v_gross_mg <= 0 or v_fine_mg <= 0 then
    raise exception 'Weight must be greater than zero.' using errcode = '23514';
  end if;

  insert into public.supplier_purchases (
    id, firm_id, branch_id, purchase_no, supplier_id, invoice_no, invoice_date,
    metal, purity_permille, gross_mg, fine_mg,
    subtotal_paise, gst_rate_pct, gst_paise, total_paise, paid_paise, due_paise,
    gold_paid_fine_mg, data
  ) values (
    v_id,
    v_firm,
    v_branch,
    v_purchase_no,
    v_supplier_id,
    nullif(p_payload->>'invoiceNo', ''),
    coalesce((p_payload->>'invoiceDate')::date, current_date),
    v_metal,
    v_purity,
    v_gross_mg,
    v_fine_mg,
    coalesce((p_payload->>'subtotalPaise')::bigint, 0),
    coalesce((p_payload->>'gstRatePct')::numeric, 0),
    coalesce((p_payload->>'gstPaise')::bigint, 0),
    coalesce((p_payload->>'totalPaise')::bigint, 0),
    coalesce((p_payload->>'paidPaise')::bigint, 0),
    coalesce((p_payload->>'duePaise')::bigint, 0),
    v_gold_paid,
    p_payload
  );

  if lower(v_metal) = 'gold' then
    v_ledger_entries := v_ledger_entries || jsonb_build_array(
      jsonb_build_object(
        'id', gen_random_uuid()::text,
        'type', 'purchase',
        'netFineMg', v_fine_mg,
        'deltas', jsonb_build_object('vault', v_fine_mg),
        'grossMg', v_gross_mg,
        'purity', v_purity,
        'fineMg', v_fine_mg,
        'notes', v_purchase_no || ' · supplier purchase',
        'reference', v_id::text
      )
    );
    if v_gold_paid > 0 then
      v_ledger_entries := v_ledger_entries || jsonb_build_array(
        jsonb_build_object(
          'id', gen_random_uuid()::text,
          'type', 'purchase',
          'netFineMg', -v_gold_paid,
          'deltas', jsonb_build_object('vault', -v_gold_paid),
          'fineMg', v_gold_paid,
          'purity', v_purity,
          'notes', v_purchase_no || ' · gold payment to supplier',
          'reference', v_id::text
        )
      );
    end if;
    v_result := public.post_gold_ledger_entries(v_ledger_entries);
    v_ledger_ref := v_result->0->>'id';
  else
    insert into public.material_vault_movements (
      id, firm_id, branch_id, data
    ) values (
      gen_random_uuid()::text,
      v_firm,
      v_branch,
      jsonb_build_object(
        'category', coalesce(nullif(p_payload->>'vaultCategory', ''), 'raw_material'),
        'type', 'purchase',
        'metal', v_metal,
        'purity', v_purity,
        'grossMg', v_gross_mg,
        'deltaMg', v_gross_mg,
        'ownership', 'company',
        'remarks', v_purchase_no || ' · supplier purchase',
        'supplierPurchaseId', v_id::text
      )
    );
    v_ledger_ref := null;
  end if;

  return jsonb_build_object(
    'id', v_id,
    'purchaseNo', v_purchase_no,
    'ledgerRef', v_ledger_ref
  );
end;
$$;

revoke all on function public.post_supplier_purchase(jsonb) from public, anon;
grant execute on function public.post_supplier_purchase(jsonb) to authenticated;