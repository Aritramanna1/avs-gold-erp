-- Metal ledger indexes: gold_ledger and material_vault_movements are read on
-- every ledger/vault query filtered by firm_id (RLS on both tables checks
-- firm_id = my_firm_id()), and gold_ledger is additionally ordered by ts DESC
-- (useLedger.refresh()). Neither had an index covering firm_id before this,
-- so every multi-tenant read fell back to a full table scan filtered in memory.

CREATE INDEX IF NOT EXISTS idx_gold_ledger_firm_ts
  ON public.gold_ledger USING btree (firm_id, ts DESC);

CREATE INDEX IF NOT EXISTS idx_gold_ledger_responsible_person
  ON public.gold_ledger USING btree (responsible_person_id)
  WHERE responsible_person_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_material_vault_movements_firm_created
  ON public.material_vault_movements USING btree (firm_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_material_vault_movements_branch
  ON public.material_vault_movements USING btree (branch_id)
  WHERE branch_id IS NOT NULL;
