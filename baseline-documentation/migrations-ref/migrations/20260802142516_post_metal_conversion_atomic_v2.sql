-- Reconciled from production (project dqgrrafuoxaorvyrcuuh) on 2026-08-11 — this migration was applied directly to Supabase and had no local file until now.

create or replace function public.post_metal_conversion(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_firm uuid;
  v_branch text;
  v_id text;
  v_batch_no text;
  v_source_metal text;
  v_dest_metal text;
  v_source_purity int;
  v_dest_purity int;
  v_fine_mg bigint;
  v_output_fine_mg bigint;
  v_output_gross_mg bigint;
  v_loss_mg bigint;
  v_ledger_entries jsonb := '[]'::jsonb;
  v_ledger_result jsonb;
  v_alloy jsonb;
  v_alloy_mg bigint;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'p_payload must be a JSON object' using errcode = '22023';
  end if;

  v_firm := public.my_firm_id();
  if v_firm is null and not public.has_role(auth.uid(), 'saas_admin'::public.app_role) then
    raise exception 'firm context required' using errcode = '42501';
  end if;

  if not public.tenant_module_write_allowed('melt_account') then
    raise exception 'Metal Conversion module is not enabled' using errcode = '42501';
  end if;

  v_id := coalesce(nullif(p_payload->>'id', ''), nullif(p_payload->>'batchNo', ''), 'CNV-' || substr(gen_random_uuid()::text, 1, 8));
  v_batch_no := coalesce(nullif(p_payload->>'batchNo', ''), v_id);
  v_branch := coalesce(nullif(p_payload->>'branchId', ''), 'MAIN');
  v_source_metal := coalesce(nullif(p_payload->>'sourceMetal', ''), 'Gold');
  v_dest_metal := coalesce(nullif(p_payload->>'destinationMetal', ''), 'Gold');
  v_source_purity := coalesce((p_payload->>'sourcePurity')::int, 999);
  v_dest_purity := coalesce((p_payload->>'destPurity')::int, 916);
  v_fine_mg := coalesce((p_payload->>'fineMetalRequiredMg')::bigint, (p_payload->>'fineMetalWeightMg')::bigint, 0);
  v_output_fine_mg := coalesce((p_payload->>'outputFineMg')::bigint, 0);
  v_output_gross_mg := coalesce((p_payload->>'netOutputWeightMg')::bigint, v_output_fine_mg);
  v_loss_mg := coalesce((p_payload->>'conversionLossMg')::bigint, greatest(0, v_fine_mg - v_output_fine_mg));

  if v_fine_mg <= 0 or v_output_fine_mg <= 0 then
    raise exception 'Conversion weights must be greater than zero.' using errcode = '23514';
  end if;

  if lower(v_source_metal) = 'gold' and lower(v_dest_metal) = 'gold' then
    v_ledger_entries := v_ledger_entries || jsonb_build_array(
      jsonb_build_object(
        'id', gen_random_uuid()::text,
        'type', 'conversion_deducted',
        'netFineMg', -v_fine_mg,
        'deltas', jsonb_build_object('vault', -v_fine_mg),
        'purity', v_source_purity,
        'fineMg', v_fine_mg,
        'reference', v_batch_no,
        'notes', 'Metal conversion ' || v_batch_no || ': source deducted'
      ),
      jsonb_build_object(
        'id', gen_random_uuid()::text,
        'type', 'conversion_added',
        'netFineMg', v_output_fine_mg,
        'deltas', jsonb_build_object('vault', v_output_fine_mg),
        'purity', v_dest_purity,
        'fineMg', v_output_fine_mg,
        'reference', v_batch_no,
        'notes', 'Metal conversion ' || v_batch_no || ': destination added'
      )
    );
    v_ledger_result := public.post_gold_ledger_entries(v_ledger_entries);
  end if;

  for v_alloy in select * from jsonb_array_elements(coalesce(p_payload->'extraAlloyLines', '[]'::jsonb))
  loop
    v_alloy_mg := coalesce((v_alloy->>'weightMg')::bigint, 0);
    if v_alloy_mg > 0 then
      insert into public.material_vault_movements (id, firm_id, branch_id, data)
      values (
        gen_random_uuid()::text,
        v_firm,
        v_branch,
        jsonb_build_object(
          'category', 'other_material',
          'type', 'conversion_out',
          'metal', coalesce(v_alloy->>'material', 'Alloy'),
          'form', coalesce(v_alloy->>'form', ''),
          'location', coalesce(v_alloy->>'location', ''),
          'purity', coalesce((v_alloy->>'purityPermille')::int, 0),
          'deltaMg', -v_alloy_mg,
          'grossMg', v_alloy_mg,
          'ownership', 'company',
          'conversionGroupId', v_batch_no,
          'remarks', 'Conversion alloy deduct ' || v_batch_no
        )
      );
    end if;
  end loop;

  if v_loss_mg > 0 then
    insert into public.material_vault_movements (id, firm_id, branch_id, data)
    values (
      gen_random_uuid()::text,
      v_firm,
      v_branch,
      jsonb_build_object(
        'category', 'recovery_gold',
        'type', 'conversion_loss',
        'metal', v_dest_metal,
        'deltaMg', v_loss_mg,
        'grossMg', v_loss_mg,
        'purity', v_dest_purity,
        'ownership', 'company',
        'conversionGroupId', v_batch_no,
        'remarks', 'Conversion loss/scrap ' || v_batch_no
      )
    );
  end if;

  insert into public.metal_conversions (id, firm_id, branch_id, data)
  values (v_id, v_firm, v_branch, p_payload || jsonb_build_object('id', v_id, 'batchNo', v_batch_no))
  on conflict (id) do update set data = excluded.data, branch_id = excluded.branch_id;

  return jsonb_build_object(
    'id', v_id,
    'batchNo', v_batch_no,
    'ledgerRefOut', coalesce(v_ledger_result->0->>'id', v_batch_no),
    'ledgerRefIn', coalesce(v_ledger_result->1->>'id', v_batch_no)
  );
end;
$$;

revoke all on function public.post_metal_conversion(jsonb) from public, anon;
grant execute on function public.post_metal_conversion(jsonb) to authenticated;
