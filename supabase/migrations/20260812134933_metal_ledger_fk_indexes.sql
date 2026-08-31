-- Remaining unindexed foreign keys on metal/vault-adjacent tables, found by
-- the Supabase performance advisor right after 20260812134630's ledger index
-- pass. Every one of these FK columns is also an RLS filter column
-- (firm_id/branch_id) or a lookup join key, so an unindexed FK here means a
-- full table scan on every read, delete, and cascade check.

CREATE INDEX IF NOT EXISTS idx_melt_jobs_firm_id ON public.melt_jobs USING btree (firm_id);

CREATE INDEX IF NOT EXISTS idx_precious_metal_purities_firm_id ON public.precious_metal_purities USING btree (firm_id);
CREATE INDEX IF NOT EXISTS idx_precious_metal_purities_metal_id ON public.precious_metal_purities USING btree (metal_id);

CREATE INDEX IF NOT EXISTS idx_metal_composition_formulas_created_by ON public.metal_composition_formulas USING btree (created_by);
CREATE INDEX IF NOT EXISTS idx_metal_composition_formulas_firm_id ON public.metal_composition_formulas USING btree (firm_id);
CREATE INDEX IF NOT EXISTS idx_metal_composition_formulas_metal_id ON public.metal_composition_formulas USING btree (metal_id);
CREATE INDEX IF NOT EXISTS idx_metal_composition_formulas_target_purity_id ON public.metal_composition_formulas USING btree (target_purity_id);

CREATE INDEX IF NOT EXISTS idx_metal_conversions_branch_id ON public.metal_conversions USING btree (branch_id);
CREATE INDEX IF NOT EXISTS idx_metal_conversions_firm_id ON public.metal_conversions USING btree (firm_id);

CREATE INDEX IF NOT EXISTS idx_customer_gold_deposits_branch_id ON public.customer_gold_deposits USING btree (branch_id);
CREATE INDEX IF NOT EXISTS idx_customer_gold_deposits_firm_id ON public.customer_gold_deposits USING btree (firm_id);
