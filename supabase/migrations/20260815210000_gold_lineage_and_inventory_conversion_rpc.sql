-- Gold lineage traceability + atomic inventory metal conversion RPC
-- Enforces firm isolation; preserves customer ownership liability when melting customer lots.

CREATE TABLE IF NOT EXISTS public.gold_lineage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL DEFAULT public.my_firm_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id TEXT REFERENCES public.branches(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  source_lot_number TEXT,
  target_lot_number TEXT,
  voucher_ref TEXT,
  gross_weight_mg BIGINT NOT NULL DEFAULT 0,
  touch_purity NUMERIC(6, 3) NOT NULL DEFAULT 0,
  fine_gold_mg BIGINT NOT NULL DEFAULT 0,
  from_location TEXT,
  to_location TEXT,
  party_name TEXT,
  operator_name TEXT,
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gold_lineage_firm_created
  ON public.gold_lineage_events (firm_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gold_lineage_source_lot
  ON public.gold_lineage_events (firm_id, source_lot_number);
CREATE INDEX IF NOT EXISTS idx_gold_lineage_target_lot
  ON public.gold_lineage_events (firm_id, target_lot_number);

ALTER TABLE public.gold_lineage_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'gold_lineage_events'
      AND policyname = 'Users can manage firm gold lineage events'
  ) THEN
    CREATE POLICY "Users can manage firm gold lineage events"
      ON public.gold_lineage_events FOR ALL
      USING (firm_id = public.my_firm_id())
      WITH CHECK (firm_id = public.my_firm_id());
  END IF;
END $$;

-- Atomic lot-level conversion with gram-level lineage (integer mg storage)
CREATE OR REPLACE FUNCTION public.rpc_execute_inventory_metal_conversion(
  p_source_lot_id UUID,
  p_source_gross_mg BIGINT,
  p_target_purity_karat TEXT,
  p_target_touch NUMERIC,
  p_alloy_added_mg BIGINT DEFAULT 0,
  p_expected_loss_mg BIGINT DEFAULT 0,
  p_target_vault TEXT DEFAULT 'Main Vault',
  p_target_form TEXT DEFAULT 'granules',
  p_operator_name TEXT DEFAULT 'System',
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_firm UUID;
  v_source public.metal_inventory_lots%ROWTYPE;
  v_source_fine_mg BIGINT;
  v_output_gross_mg BIGINT;
  v_output_fine_mg BIGINT;
  v_output_lot_id UUID;
  v_output_lot_number TEXT;
  v_voucher_ref TEXT;
BEGIN
  v_firm := public.my_firm_id();
  IF v_firm IS NULL THEN
    RAISE EXCEPTION 'firm context required' USING ERRCODE = '42501';
  END IF;

  IF p_source_gross_mg <= 0 THEN
    RAISE EXCEPTION 'source gross weight must be positive' USING ERRCODE = '23514';
  END IF;

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

  v_source_fine_mg := ROUND((p_source_gross_mg::NUMERIC * v_source.touch_purity) / 100.0)::BIGINT;
  v_output_gross_mg := GREATEST(0, p_source_gross_mg + COALESCE(p_alloy_added_mg, 0) - COALESCE(p_expected_loss_mg, 0));
  v_output_fine_mg := ROUND((v_output_gross_mg::NUMERIC * p_target_touch) / 100.0)::BIGINT;
  v_output_lot_id := gen_random_uuid();
  v_output_lot_number := 'LOT-' || COALESCE(p_target_purity_karat, '22K') || '-' ||
    REPLACE(ROUND(p_target_touch * 10)::TEXT, '.', '') || '-' ||
    SUBSTR(REPLACE(gen_random_uuid()::TEXT, '-', ''), 1, 6);
  v_voucher_ref := 'CONV-' || TO_CHAR(now(), 'YYYYMMDD') || '-' || SUBSTR(v_output_lot_id::TEXT, 1, 8);

  UPDATE public.metal_inventory_lots
  SET
    available_gross_weight_mg = available_gross_weight_mg - p_source_gross_mg,
    available_fine_gold_mg = GREATEST(0, available_fine_gold_mg - v_source_fine_mg),
    updated_at = now()
  WHERE id = v_source.id;

  INSERT INTO public.metal_inventory_lots (
    id, firm_id, branch_id, lot_number, metal_type, purity_karat, touch_purity,
    physical_form, vault_location, gross_weight_mg, fine_gold_mg,
    available_gross_weight_mg, available_fine_gold_mg, ownership_party_id, is_active
  ) VALUES (
    v_output_lot_id, v_firm, v_source.branch_id, v_output_lot_number, 'gold',
    COALESCE(p_target_purity_karat, '22K'), p_target_touch,
    COALESCE(p_target_form, 'granules'), COALESCE(p_target_vault, 'Main Vault'),
    v_output_gross_mg, v_output_fine_mg,
    v_output_gross_mg, v_output_fine_mg,
    NULL, true
  );

  -- Customer ownership: mark liability position as physically utilized (liability remains)
  IF v_source.ownership_party_id IS NOT NULL THEN
    UPDATE public.gold_ownership_positions
    SET
      physical_is_utilized = true,
      physical_custodian_type = 'melting_crucible',
      updated_at = now()
    WHERE firm_id = v_firm
      AND physical_lot_id = v_source.id::TEXT
      AND liability_status = 'active';
  END IF;

  INSERT INTO public.gold_lineage_events (
    firm_id, branch_id, event_type, source_lot_number, target_lot_number,
    voucher_ref, gross_weight_mg, touch_purity, fine_gold_mg,
    from_location, to_location, operator_name, notes
  ) VALUES (
    v_firm, v_source.branch_id, 'melt_conversion',
    v_source.lot_number, v_output_lot_number, v_voucher_ref,
    v_output_gross_mg, p_target_touch, v_output_fine_mg,
    v_source.vault_location, COALESCE(p_target_vault, 'Main Vault'),
    COALESCE(p_operator_name, 'System'),
    COALESCE(p_notes, 'Converted ' || p_source_gross_mg || 'mg source + ' ||
      COALESCE(p_alloy_added_mg, 0) || 'mg alloy. Loss: ' || COALESCE(p_expected_loss_mg, 0) || 'mg')
  );

  RETURN jsonb_build_object(
    'success', true,
    'outputLotId', v_output_lot_id,
    'outputLotNumber', v_output_lot_number,
    'voucherRef', v_voucher_ref,
    'outputGrossMg', v_output_gross_mg,
    'outputFineMg', v_output_fine_mg
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_execute_inventory_metal_conversion(
  UUID, BIGINT, TEXT, NUMERIC, BIGINT, BIGINT, TEXT, TEXT, TEXT, TEXT
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_execute_inventory_metal_conversion(
  UUID, BIGINT, TEXT, NUMERIC, BIGINT, BIGINT, TEXT, TEXT, TEXT, TEXT
) TO authenticated;
