-- ============================================================================
-- MTJ ERP — Phase 2 Stabilization Migration (CORRECTED & idempotent)
-- ============================================================================
-- Apply via: Supabase Studio → SQL Editor → New query → paste → Run
--        OR: Management API / psql (handled by the agent).
--
-- WHAT THIS DOES
--   1. Creates `manufacturing_bills` with the EXACT columns the app writes
--      (see billToDbRow() in src/lib/manufacturing-bill-store.ts). The Manufacturing
--      Bills workflow is 100% dead until this table exists.
--   2. Adds optional operational columns to `melt_jobs` (it currently stores
--      { id, data jsonb } only). The Melt Account module already works against the
--      jsonb shape; these columns + back-fill simply enable native column filtering
--      and indexing. They are additive and safe.
--   3. RLS MODEL — matches every other working table in this database:
--        any authenticated user has full access; branch isolation is enforced
--        client-side (see refresh() filters in the stores). We deliberately do NOT
--        gate on user_profiles / user_branch_permissions because those tables are
--        empty / absent in this project and would lock everyone out.
--
-- SAFETY: every statement is guarded (IF NOT EXISTS / DROP POLICY IF EXISTS).
--         Re-running is harmless. No existing row data is modified or deleted.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. manufacturing_bills  (column list mirrors billToDbRow() exactly)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.manufacturing_bills (
  id                          text PRIMARY KEY,
  bill_no                     text,
  created_at                  timestamptz DEFAULT now(),
  finalised_at                timestamptz,
  updated_at                  timestamptz DEFAULT now(),
  status                      text DEFAULT 'draft',
  branch_id                   text,

  -- linkage
  job_card_id                 text,
  job_no                      text,
  order_id                    text,
  order_no                    text,
  customer_id                 text,
  customer_name               text,
  customer_phone              text,
  customer_email              text,
  karigar_id                  text,
  karigar_name                text,

  -- item
  item_name                   text,
  category                    text,
  pcs                         integer,

  -- gold issued
  gold_issued_gross_mg        bigint,
  gold_issued_purity          integer,
  gold_issued_fine_mg         bigint,
  gold_issue_slip_no          text,
  p_entries                   text,          -- JSON.stringify(array) → stored as text

  -- gold received back
  finished_gross_mg           bigint,
  finished_purity             integer,
  finished_fine_mg            bigint,
  scrap_gross_mg              bigint,
  scrap_purity                integer,
  scrap_fine_mg               bigint,
  filings_gross_mg            bigint,
  filings_purity              integer,
  filings_fine_mg             bigint,
  dust_fine_mg                bigint,

  -- totals & wastage
  total_gold_returned_fine_mg bigint,
  total_gold_issued_fine_mg   bigint,
  actual_wastage_fine_mg      bigint,
  actual_wastage_pct          numeric,

  -- charges (paise)
  labour_charges_paise        bigint,
  stone_charges_paise         bigint,
  other_charges_paise         bigint,
  making_charges_paise        bigint,
  hallmark_charges_paise      bigint,
  stone_setting_paise         bigint,
  selling_price_paise         bigint,
  net_mfg_cost_paise          bigint,
  profit_margin_bps           integer,

  -- karigar account
  opening_balance_mg          bigint,
  mp_entries                  text,          -- JSON.stringify(array) → stored as text
  cash_payment_paise          bigint,
  gold_bhav_rate_paise        bigint,
  bhav_gold_mg                bigint,
  closing_balance_mg          bigint,

  -- post-finalisation links
  finished_stock_item_id      text,
  delivery_invoice_id         text,
  notes                       text
);

-- Defensive: if an older/partial manufacturing_bills table already exists, make sure
-- every column the app writes is present (covers a previously half-applied migration).
ALTER TABLE public.manufacturing_bills
  ADD COLUMN IF NOT EXISTS making_charges_paise   bigint,
  ADD COLUMN IF NOT EXISTS hallmark_charges_paise bigint,
  ADD COLUMN IF NOT EXISTS stone_setting_paise    bigint,
  ADD COLUMN IF NOT EXISTS selling_price_paise    bigint,
  ADD COLUMN IF NOT EXISTS net_mfg_cost_paise     bigint,
  ADD COLUMN IF NOT EXISTS profit_margin_bps      integer,
  ADD COLUMN IF NOT EXISTS p_entries              text,
  ADD COLUMN IF NOT EXISTS mp_entries             text;

CREATE INDEX IF NOT EXISTS idx_mfg_bills_branch     ON public.manufacturing_bills(branch_id);
CREATE INDEX IF NOT EXISTS idx_mfg_bills_status     ON public.manufacturing_bills(status);
CREATE INDEX IF NOT EXISTS idx_mfg_bills_job_card   ON public.manufacturing_bills(job_card_id);
CREATE INDEX IF NOT EXISTS idx_mfg_bills_customer   ON public.manufacturing_bills(customer_id);
CREATE INDEX IF NOT EXISTS idx_mfg_bills_created_at ON public.manufacturing_bills(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mfg_bills_bill_no    ON public.manufacturing_bills(bill_no);

ALTER TABLE public.manufacturing_bills ENABLE ROW LEVEL SECURITY;

-- Authenticated users get full access (matches people/orders/invoices/job_cards in this DB).
DROP POLICY IF EXISTS mfg_bills_select ON public.manufacturing_bills;
DROP POLICY IF EXISTS mfg_bills_modify ON public.manufacturing_bills;
DROP POLICY IF EXISTS mfg_bills_all    ON public.manufacturing_bills;
CREATE POLICY mfg_bills_all ON public.manufacturing_bills
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 2. melt_jobs — additive operational columns (table is { id, data jsonb })
--    RLS is intentionally left untouched: the module already works.
-- ---------------------------------------------------------------------------
ALTER TABLE public.melt_jobs
  ADD COLUMN IF NOT EXISTS job_no                 text,
  ADD COLUMN IF NOT EXISTS branch_id              text,
  ADD COLUMN IF NOT EXISTS date                   date,
  ADD COLUMN IF NOT EXISTS status                 text,
  ADD COLUMN IF NOT EXISTS total_input_fine_mg    bigint,
  ADD COLUMN IF NOT EXISTS fine_gold_recovered_mg bigint,
  ADD COLUMN IF NOT EXISTS loss_fine_mg           bigint,
  ADD COLUMN IF NOT EXISTS created_at             timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at             timestamptz DEFAULT now();

-- Back-fill the new columns from the existing jsonb payload (safe to re-run).
UPDATE public.melt_jobs
SET
  job_no                 = COALESCE(job_no,                 data->>'jobNo'),
  branch_id              = COALESCE(branch_id,              data->>'branchId'),
  date                   = COALESCE(date,                   NULLIF(data->>'date', '')::date),
  status                 = COALESCE(status,                 data->>'status'),
  total_input_fine_mg    = COALESCE(total_input_fine_mg,    NULLIF(data->>'totalInputFineMg','')::bigint),
  fine_gold_recovered_mg = COALESCE(fine_gold_recovered_mg, NULLIF(data->>'fineGoldRecoveredMg','')::bigint),
  loss_fine_mg           = COALESCE(loss_fine_mg,           NULLIF(data->>'lossFineMg','')::bigint)
WHERE data IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_melt_jobs_branch ON public.melt_jobs(branch_id);
CREATE INDEX IF NOT EXISTS idx_melt_jobs_status ON public.melt_jobs(status);
CREATE INDEX IF NOT EXISTS idx_melt_jobs_date   ON public.melt_jobs(date DESC);

-- ---------------------------------------------------------------------------
-- 3. Realtime publication (so the ERP's realtime sync picks up mfg bills)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'manufacturing_bills'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.manufacturing_bills';
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Could not add manufacturing_bills to supabase_realtime: %', SQLERRM;
END $$;
