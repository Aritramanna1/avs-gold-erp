-- ============================================================
-- MTJ ERP — Manufacturing Bills Table
-- Migration: 20260628000000
-- ============================================================

CREATE TABLE IF NOT EXISTS public.manufacturing_bills (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_no                   TEXT NOT NULL UNIQUE,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finalised_at              TIMESTAMPTZ,
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status                    TEXT NOT NULL DEFAULT 'draft'
                              CHECK (status IN ('draft', 'finalised', 'delivered', 'settled')),
  branch_id                 TEXT NOT NULL DEFAULT 'branch_mfg_ich',

  -- Links
  job_card_id               TEXT NOT NULL,
  job_no                    TEXT NOT NULL,
  order_id                  TEXT NOT NULL,
  order_no                  TEXT NOT NULL,
  customer_id               TEXT NOT NULL,
  customer_name             TEXT NOT NULL,
  customer_phone            TEXT,
  customer_email            TEXT,
  karigar_id                TEXT,
  karigar_name              TEXT,

  -- Item
  item_name                 TEXT NOT NULL,
  category                  TEXT NOT NULL DEFAULT '',
  pcs                       INTEGER NOT NULL DEFAULT 1,

  -- Gold Issued
  gold_issued_gross_mg      INTEGER NOT NULL DEFAULT 0,
  gold_issued_purity        INTEGER NOT NULL DEFAULT 916,
  gold_issued_fine_mg       INTEGER NOT NULL DEFAULT 0,
  gold_issue_slip_no        TEXT NOT NULL DEFAULT '',

  -- P Entries (JSON array of PEntry objects)
  p_entries                 TEXT NOT NULL DEFAULT '[]',

  -- Karigar Returns
  finished_gross_mg         INTEGER NOT NULL DEFAULT 0,
  finished_purity           INTEGER NOT NULL DEFAULT 916,
  finished_fine_mg          INTEGER NOT NULL DEFAULT 0,
  scrap_gross_mg            INTEGER NOT NULL DEFAULT 0,
  scrap_purity              INTEGER NOT NULL DEFAULT 300,
  scrap_fine_mg             INTEGER NOT NULL DEFAULT 0,
  filings_gross_mg          INTEGER NOT NULL DEFAULT 0,
  filings_purity            INTEGER NOT NULL DEFAULT 250,
  filings_fine_mg           INTEGER NOT NULL DEFAULT 0,
  dust_fine_mg              INTEGER NOT NULL DEFAULT 0,

  -- Computed Gold Summary
  total_gold_returned_fine_mg INTEGER NOT NULL DEFAULT 0,
  total_gold_issued_fine_mg   INTEGER NOT NULL DEFAULT 0,
  actual_wastage_fine_mg      INTEGER NOT NULL DEFAULT 0,
  actual_wastage_pct          NUMERIC(6,3) NOT NULL DEFAULT 0,

  -- Charges (all in paise)
  labour_charges_paise      INTEGER NOT NULL DEFAULT 0,
  stone_charges_paise       INTEGER NOT NULL DEFAULT 0,
  other_charges_paise       INTEGER NOT NULL DEFAULT 0,

  -- Karigar Account
  opening_balance_mg        INTEGER NOT NULL DEFAULT 0,
  mp_entries                TEXT NOT NULL DEFAULT '[]',
  cash_payment_paise        INTEGER NOT NULL DEFAULT 0,
  gold_bhav_rate_paise      INTEGER NOT NULL DEFAULT 0,
  bhav_gold_mg              INTEGER NOT NULL DEFAULT 0,
  closing_balance_mg        INTEGER NOT NULL DEFAULT 0,

  -- Post-finalisation links
  finished_stock_item_id    TEXT,
  delivery_invoice_id       TEXT,

  notes                     TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_mfg_bills_branch    ON public.manufacturing_bills(branch_id);
CREATE INDEX IF NOT EXISTS idx_mfg_bills_status    ON public.manufacturing_bills(status);
CREATE INDEX IF NOT EXISTS idx_mfg_bills_customer  ON public.manufacturing_bills(customer_id);
CREATE INDEX IF NOT EXISTS idx_mfg_bills_job       ON public.manufacturing_bills(job_card_id);
CREATE INDEX IF NOT EXISTS idx_mfg_bills_order     ON public.manufacturing_bills(order_id);

-- Updated_at trigger
CREATE OR REPLACE TRIGGER mfg_bills_updated_at
  BEFORE UPDATE ON public.manufacturing_bills
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.manufacturing_bills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mfg_bills_branch_isolation" ON public.manufacturing_bills;
CREATE POLICY "mfg_bills_branch_isolation" ON public.manufacturing_bills
  FOR ALL USING (public.can_access_branch(branch_id));

-- ── Customer Ledger View ──────────────────────────────────────────────────────
-- Consolidates advance, payments, outstanding across invoices + mfg bills per customer.
-- Used by the customer ledger screen and communication module.

CREATE OR REPLACE VIEW public.customer_ledger_summary AS
SELECT
  i.customer_id,
  i.branch_id,
  COUNT(i.id)                                               AS invoice_count,
  COALESCE(SUM(i.grand_total_paise), 0)                    AS total_billed_paise,
  COALESCE(SUM(CASE WHEN i.payment_status = 'paid' THEN i.grand_total_paise ELSE 0 END), 0)
                                                            AS total_paid_paise,
  COALESCE(SUM(CASE WHEN i.payment_status != 'paid' THEN i.outstanding_paise ELSE 0 END), 0)
                                                            AS outstanding_paise,
  COALESCE(SUM(i.advance_paise), 0)                        AS total_advance_paise,
  MAX(i.created_at)                                         AS last_transaction_at
FROM public.invoices i
GROUP BY i.customer_id, i.branch_id;

COMMENT ON VIEW public.customer_ledger_summary IS
  'Per-customer financial summary across all invoices. Join with customers table for full profile.';

-- ── Finished Stock: add mfg_bill link ────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'stock_items'
  ) THEN
    -- Add manufacturing bill link if not already there
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'stock_items'
        AND column_name = 'linked_mfg_bill_id'
    ) THEN
      ALTER TABLE public.stock_items
        ADD COLUMN linked_mfg_bill_id TEXT,
        ADD COLUMN status TEXT NOT NULL DEFAULT 'in_stock',
        ADD COLUMN linked_order_id TEXT;
      RAISE NOTICE 'Added linked_mfg_bill_id, status, linked_order_id to stock_items';
    END IF;
  END IF;
END $$;

-- ── Invoice: add outstanding tracking columns ────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'invoices'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'invoices'
        AND column_name = 'payment_status'
    ) THEN
      ALTER TABLE public.invoices
        ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'pending'
          CHECK (payment_status IN ('pending', 'partial', 'paid', 'outstanding')),
        ADD COLUMN outstanding_paise INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN advance_paise INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN linked_mfg_bill_id TEXT;
      RAISE NOTICE 'Added payment_status, outstanding_paise, advance_paise, linked_mfg_bill_id to invoices';
    END IF;
  END IF;
END $$;
