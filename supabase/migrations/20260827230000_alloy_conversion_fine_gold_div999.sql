-- Align alloy_lines overload of rpc_execute_inventory_metal_conversion with
-- app fineGoldMg: ROUND(gross_mg * purity_permille / 999).
-- touch_purity / p_target_touch may be percent (91.6) or already permille (916).

CREATE OR REPLACE FUNCTION public.rpc_execute_inventory_metal_conversion(
  p_source_lot_id uuid,
  p_source_gross_mg bigint,
  p_target_purity_karat text,
  p_target_touch numeric,
  p_alloy_added_mg bigint DEFAULT 0,
  p_expected_loss_mg bigint DEFAULT 0,
  p_target_vault text DEFAULT 'Main Vault'::text,
  p_target_form text DEFAULT 'granules'::text,
  p_operator_name text DEFAULT 'System'::text,
  p_notes text DEFAULT NULL::text,
  p_alloy_lines jsonb DEFAULT NULL::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_firm uuid;
  v_source public.metal_inventory_lots%ROWTYPE;
  v_source_fine_mg bigint;
  v_output_gross_mg bigint;
  v_output_fine_mg bigint;
  v_output_lot_id uuid;
  v_output_lot_number text;
  v_voucher_ref text;
  v_alloy_total_mg bigint := 0;
  v_alloy jsonb;
  v_alloy_mg bigint;
  v_alloy_category text;
  v_alloy_metal text;
  v_alloy_purity int;
  v_alloy_type text;
  v_stock bigint;
  v_source_purity_pmille integer;
  v_target_purity_pmille integer;
BEGIN
  v_firm := public.my_firm_id();
  IF v_firm IS NULL THEN
    RAISE EXCEPTION 'firm context required' USING ERRCODE = '42501';
  END IF;

  IF p_source_gross_mg <= 0 THEN
    RAISE EXCEPTION 'source gross weight must be positive' USING ERRCODE = '23514';
  END IF;

  IF p_alloy_lines IS NOT NULL AND jsonb_typeof(p_alloy_lines) = 'array' THEN
    SELECT coalesce(sum((elem->>'weightMg')::bigint), 0)
      INTO v_alloy_total_mg
    FROM jsonb_array_elements(p_alloy_lines) elem
    WHERE coalesce((elem->>'weightMg')::bigint, 0) > 0;
  ELSE
    v_alloy_total_mg := coalesce(p_alloy_added_mg, 0);
  END IF;

  FOR v_alloy IN SELECT * FROM jsonb_array_elements(coalesce(p_alloy_lines, '[]'::jsonb))
  LOOP
    v_alloy_mg := coalesce((v_alloy->>'weightMg')::bigint, 0);
    IF v_alloy_mg <= 0 THEN
      CONTINUE;
    END IF;
    v_alloy_category := coalesce(
      nullif(v_alloy->>'categoryKey', ''),
      nullif(v_alloy->>'category', ''),
      'other_material'
    );
    v_alloy_metal := coalesce(nullif(v_alloy->>'material', ''), 'Alloy');
    v_alloy_purity := coalesce(
      (v_alloy->>'purityPermille')::int,
      (v_alloy->>'purity')::int,
      0
    );
    v_stock := public.material_vault_stock_mg(v_firm, v_alloy_category, v_alloy_metal, v_alloy_purity);
    IF v_stock < v_alloy_mg THEN
      RAISE EXCEPTION 'Insufficient % stock (%): need % mg, available % mg',
        v_alloy_metal, v_alloy_category, v_alloy_mg, v_stock
        USING ERRCODE = '23514';
    END IF;
  END LOOP;

  SELECT * INTO v_source
  FROM public.metal_inventory_lots
  WHERE id = p_source_lot_id
    AND firm_id = v_firm
    AND is_active = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'source lot not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_source.available_gross_weight_mg < p_source_gross_mg THEN
    RAISE EXCEPTION 'insufficient available stock in lot %', v_source.lot_number
      USING ERRCODE = '23514';
  END IF;

  v_source_purity_pmille := CASE
    WHEN v_source.touch_purity > 100 THEN LEAST(999, ROUND(v_source.touch_purity)::INTEGER)
    ELSE LEAST(999, ROUND(v_source.touch_purity * 10)::INTEGER)
  END;
  v_target_purity_pmille := CASE
    WHEN p_target_touch > 100 THEN LEAST(999, ROUND(p_target_touch)::INTEGER)
    ELSE LEAST(999, ROUND(p_target_touch * 10)::INTEGER)
  END;

  v_source_fine_mg := ROUND((p_source_gross_mg::numeric * v_source_purity_pmille) / 999.0)::bigint;
  v_output_gross_mg := greatest(0, p_source_gross_mg + v_alloy_total_mg - coalesce(p_expected_loss_mg, 0));
  v_output_fine_mg := ROUND((v_output_gross_mg::numeric * v_target_purity_pmille) / 999.0)::bigint;
  v_output_lot_id := gen_random_uuid();
  v_output_lot_number := 'LOT-' || coalesce(p_target_purity_karat, '22K') || '-' ||
    replace(round(p_target_touch * 10)::text, '.', '') || '-' ||
    substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
  v_voucher_ref := 'CONV-' || to_char(now(), 'YYYYMMDD') || '-' || substr(v_output_lot_id::text, 1, 8);

  UPDATE public.metal_inventory_lots
  SET
    available_gross_weight_mg = available_gross_weight_mg - p_source_gross_mg,
    available_fine_gold_mg = greatest(0, available_fine_gold_mg - v_source_fine_mg),
    updated_at = now()
  WHERE id = v_source.id;

  INSERT INTO public.metal_inventory_lots (
    id, firm_id, branch_id, lot_number, metal_type, purity_karat, touch_purity,
    physical_form, vault_location, gross_weight_mg, fine_gold_mg,
    available_gross_weight_mg, available_fine_gold_mg, ownership_party_id, is_active
  ) VALUES (
    v_output_lot_id, v_firm, v_source.branch_id, v_output_lot_number, 'gold',
    coalesce(p_target_purity_karat, '22K'), p_target_touch,
    coalesce(p_target_form, 'granules'), coalesce(p_target_vault, 'Main Vault'),
    v_output_gross_mg, v_output_fine_mg,
    v_output_gross_mg, v_output_fine_mg,
    null, true
  );

  IF v_source.ownership_party_id IS NOT NULL THEN
    UPDATE public.gold_ownership_positions
    SET
      physical_is_utilized = true,
      physical_custodian_type = 'melting_crucible',
      updated_at = now()
    WHERE firm_id = v_firm
      AND physical_lot_id = v_source.id::text
      AND liability_status = 'active';
  END IF;

  FOR v_alloy IN SELECT * FROM jsonb_array_elements(coalesce(p_alloy_lines, '[]'::jsonb))
  LOOP
    v_alloy_mg := coalesce((v_alloy->>'weightMg')::bigint, 0);
    IF v_alloy_mg <= 0 THEN
      CONTINUE;
    END IF;
    v_alloy_category := coalesce(
      nullif(v_alloy->>'categoryKey', ''),
      nullif(v_alloy->>'category', ''),
      'other_material'
    );
    v_alloy_metal := coalesce(nullif(v_alloy->>'material', ''), 'Alloy');
    v_alloy_purity := coalesce(
      (v_alloy->>'purityPermille')::int,
      (v_alloy->>'purity')::int,
      0
    );
    v_alloy_type := lower(coalesce(nullif(v_alloy->>'materialType', ''), 'other'));
    INSERT INTO public.material_vault_movements (id, firm_id, branch_id, data)
    VALUES (
      gen_random_uuid()::text,
      v_firm,
      coalesce(v_source.branch_id, 'MAIN'),
      jsonb_build_object(
        'category', v_alloy_category,
        'type', 'conversion_out',
        'metal', v_alloy_metal,
        'purity', v_alloy_purity,
        'deltaMg', -v_alloy_mg,
        'grossMg', v_alloy_mg,
        'ownership', 'company',
        'conversionGroupId', v_voucher_ref,
        'materialType', v_alloy_type,
        'remarks', 'Inventory conversion alloy deduct ' || v_voucher_ref
      )
    );
  END LOOP;

  INSERT INTO public.gold_lineage_events (
    firm_id, branch_id, event_type, source_lot_number, target_lot_number,
    voucher_ref, gross_weight_mg, touch_purity, fine_gold_mg,
    from_location, to_location, operator_name, notes
  ) VALUES (
    v_firm, v_source.branch_id, 'melt_conversion',
    v_source.lot_number, v_output_lot_number, v_voucher_ref,
    v_output_gross_mg, p_target_touch, v_output_fine_mg,
    v_source.vault_location, coalesce(p_target_vault, 'Main Vault'),
    coalesce(p_operator_name, 'System'),
    coalesce(
      p_notes,
      'Converted ' || p_source_gross_mg || 'mg source + ' || v_alloy_total_mg ||
        'mg alloy. Loss: ' || coalesce(p_expected_loss_mg, 0) || 'mg'
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'outputLotId', v_output_lot_id,
    'outputLotNumber', v_output_lot_number,
    'voucherRef', v_voucher_ref,
    'outputGrossMg', v_output_gross_mg,
    'outputFineMg', v_output_fine_mg,
    'alloyTotalMg', v_alloy_total_mg
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_execute_inventory_metal_conversion(
  uuid, bigint, text, numeric, bigint, bigint, text, text, text, text, jsonb
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_execute_inventory_metal_conversion(
  uuid, bigint, text, numeric, bigint, bigint, text, text, text, text, jsonb
) TO authenticated;
