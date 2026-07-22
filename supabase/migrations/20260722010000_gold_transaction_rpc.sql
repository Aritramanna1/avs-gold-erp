-- ============================================================================
-- Gold Transaction Service — single atomic RPC for every physical gold/
-- material movement (Worker Issue, Worker Return, Delivery Challan, and
-- future callers). A Postgres function body is one implicit transaction —
-- any exception raised anywhere below rolls back every insert made so far
-- in this call. This is the Hybrid/Supabase-mode counterpart to the
-- Offline mode's local SQLite transaction (see local-db.ts's runLocal).
--
-- Stock validation, the Gold Ledger vault movement, the Material Vault
-- movement, and (when applicable) the Worker Gold Book entry all happen
-- here so no caller can ever write a subset of these and leave Gold Stock
-- out of sync with the rest of the app.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.execute_gold_transaction(
  p_category text,
  p_purity int,
  p_delta_mg bigint,       -- signed: negative = leaves Gold Stock, positive = enters it
  p_gross_mg bigint,
  p_movement_type text,    -- material_vault_movements movement type, e.g. 'worker_issue' / 'worker_return'
  p_ledger_movement text,  -- gold_ledger movement type, e.g. 'issue_to_karigar' / 'receive_from_karigar'
  p_branch_id text,
  p_reference text,
  p_notes text,
  p_actor_id uuid,
  p_actor_email text,
  p_worker_id text DEFAULT NULL,
  p_worker_entry jsonb DEFAULT NULL  -- full WorkerGoldBookEntry payload, or NULL when this transaction has no worker leg
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_available_mg bigint;
  v_vault_id text;
  v_ledger_id text;
  v_deltas jsonb;
  v_net_fine_mg bigint;
BEGIN
  IF p_category IS NULL OR p_delta_mg IS NULL OR p_delta_mg = 0 THEN
    RAISE EXCEPTION 'INVALID_INPUT: category and a non-zero deltaMg are required';
  END IF;

  -- Compute dynamic deltas and net fine gold weight
  IF p_worker_entry IS NOT NULL THEN
    v_deltas := jsonb_build_object('vault', p_delta_mg, 'karigar', -p_delta_mg);
    v_net_fine_mg := 0;
  ELSE
    v_deltas := jsonb_build_object('vault', p_delta_mg);
    v_net_fine_mg := p_delta_mg;
  END IF;

  -- Stock validation — only matters when material is leaving Gold Stock.
  -- Postgres disallows FOR UPDATE combined with an aggregate, so this can't
  -- lock the matching rows the way a mutable balance table would — this is
  -- an insert-only append-log (every movement is its own row), so the
  -- remaining race (two concurrent issues both reading the same pre-commit
  -- SUM) is a narrow window, not the systemic gap the old client-side-only
  -- check had. Advisory-lock on (category, purity) closes even that window
  -- for the lifetime of this transaction.
  IF p_delta_mg < 0 THEN
    PERFORM pg_advisory_xact_lock(hashtext(p_category || ':' || COALESCE(p_purity, 0)::text));

    SELECT COALESCE(SUM((data->>'deltaMg')::bigint), 0)
      INTO v_available_mg
      FROM public.material_vault_movements
      WHERE data->>'category' = p_category
        AND COALESCE((data->>'purity')::int, 0) = COALESCE(p_purity, 0);

    IF v_available_mg + p_delta_mg < 0 THEN
      RAISE EXCEPTION 'INSUFFICIENT_STOCK: % available, % requested (category=%, purity=%)',
        v_available_mg, -p_delta_mg, p_category, p_purity
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- 1) Material Vault — the per-category/purity Gold Stock ledger.
  v_vault_id := 'mv_' || replace(gen_random_uuid()::text, '-', '');
  INSERT INTO public.material_vault_movements (id, branch_id, data)
  VALUES (
    v_vault_id,
    p_branch_id,
    jsonb_build_object(
      'id', v_vault_id,
      'category', p_category,
      'purity', COALESCE(p_purity, 0),
      'type', p_movement_type,
      'deltaMg', p_delta_mg,
      'grossMg', p_gross_mg,
      'reference', p_reference,
      'remarks', p_notes,
      'actorId', p_actor_id,
      'actorEmail', p_actor_email,
      'createdAt', floor(extract(epoch FROM now()) * 1000)
    )
  );

  -- 2) Gold Ledger — company-wide vault/karigar bucket movement.
  v_ledger_id := 'gl_' || replace(gen_random_uuid()::text, '-', '');
  INSERT INTO public.gold_ledger (id, movement, net_fine_mg, bucket_deltas, reference, note, data)
  VALUES (
    v_ledger_id,
    p_ledger_movement,
    v_net_fine_mg,
    v_deltas,
    p_reference,
    p_notes,
    jsonb_build_object(
      'id', v_ledger_id,
      'createdAt', floor(extract(epoch FROM now()) * 1000),
      'type', p_ledger_movement,
      'netFineMg', v_net_fine_mg,
      'deltas', v_deltas,
      'grossMg', p_gross_mg,
      'purity', p_purity,
      'fineMg', p_gross_mg,
      'reference', p_reference,
      'notes', p_notes,
      'branchId', p_branch_id
    )
  );

  -- 3) Worker Gold Book — only when this transaction has a worker leg.
  -- Column mapping mirrors supabase-write.ts's worker_transactions branch
  -- exactly, so this RPC's rows read back identically to a plain save().
  IF p_worker_entry IS NOT NULL THEN
    INSERT INTO public.worker_transactions (id, worker_id, kind, ts, amount_paise, gold_mg, data)
    VALUES (
      p_worker_entry->>'id',
      p_worker_id,
      CASE WHEN p_worker_entry->>'type' = 'given' THEN 'gold_book_given' ELSE 'gold_book_return' END,
      now(),
      0,
      p_gross_mg,
      p_worker_entry
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'vaultMovementId', v_vault_id,
    'ledgerEntryId', v_ledger_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.execute_gold_transaction(
  text, int, bigint, bigint, text, text, text, text, text, uuid, text, text, jsonb
) TO authenticated;
