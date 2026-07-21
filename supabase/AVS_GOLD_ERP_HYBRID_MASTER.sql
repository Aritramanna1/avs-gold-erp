-- AVS Gold ERP - Owner-managed Hybrid master migration
-- Version: 1.0 (2026-07-18)
-- Run once in the Supabase SQL Editor for each customer project.
-- Structured business data only. Files and document metadata remain local.
-- This script intentionally creates no buckets and references no cloud object service.

BEGIN;

CREATE TABLE IF NOT EXISTS public.erp_schema_meta (
  id text PRIMARY KEY,
  schema_version integer NOT NULL,
  product text NOT NULL,
  deployment_model text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- Setup-only probe. Runtime anon access is intentionally not granted, so the
-- desktop can verify that the third credential is genuinely a service key.
CREATE TABLE IF NOT EXISTS public.erp_setup_guard (
  id text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.erp_setup_guard ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.erp_setup_guard FROM anon, authenticated;
GRANT SELECT ON public.erp_setup_guard TO service_role;
INSERT INTO public.erp_setup_guard(id) VALUES ('owner-setup') ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- MTJ ERP â€” pilot schema
-- Units: gold = mg (bigint), money = paise (bigint), purity = per-mille (smallint).
-- All app-level identifiers are stored as TEXT so we can keep the local-store IDs
-- on first migration. New rows server-side may also use gen_random_uuid()-derived
-- text. firm_id reserved for future multi-firm policies.
-- =====================================================================

-- Shared updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- ============== PEOPLE ===============================================
CREATE TABLE IF NOT EXISTS public.people (
  id text PRIMARY KEY,
  firm_id uuid,
  type text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  full_name text NOT NULL,
  phone text,
  whatsapp text,
  email text,
  village_city text,
  current_address text,
  permanent_address text,
  gstin text,
  pan text,
  aadhaar_masked text,
  work_type text,
  salary_rule_id text,
  notes text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.people TO authenticated;
GRANT ALL ON public.people TO service_role;
ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "people authed all" ON public.people;
CREATE POLICY "people authed all" ON public.people FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS trg_people_uat ON public.people;
CREATE TRIGGER trg_people_uat BEFORE UPDATE ON public.people FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============== GOLD LEDGER ==========================================
CREATE TABLE IF NOT EXISTS public.gold_ledger (
  id text PRIMARY KEY,
  firm_id uuid,
  ts timestamptz NOT NULL DEFAULT now(),
  movement text NOT NULL,
  net_fine_mg bigint NOT NULL,
  bucket_deltas jsonb NOT NULL DEFAULT '{}'::jsonb,
  reference text,
  note text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gold_ledger TO authenticated;
GRANT ALL ON public.gold_ledger TO service_role;
ALTER TABLE public.gold_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ledger authed all" ON public.gold_ledger;
CREATE POLICY "ledger authed all" ON public.gold_ledger FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS trg_ledger_uat ON public.gold_ledger;
CREATE TRIGGER trg_ledger_uat BEFORE UPDATE ON public.gold_ledger FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============== ATTENDANCE & WORKER ==================================
CREATE TABLE IF NOT EXISTS public.attendance (
  id text PRIMARY KEY,
  firm_id uuid,
  worker_id text NOT NULL,
  date date NOT NULL,
  status text NOT NULL,
  hours numeric(5,2),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance TO authenticated;
GRANT ALL ON public.attendance TO service_role;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "att authed all" ON public.attendance;
CREATE POLICY "att authed all" ON public.attendance FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS trg_att_uat ON public.attendance;
CREATE TRIGGER trg_att_uat BEFORE UPDATE ON public.attendance FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.salary_rules (
  id text PRIMARY KEY,
  firm_id uuid,
  name text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.salary_rules TO authenticated;
GRANT ALL ON public.salary_rules TO service_role;
ALTER TABLE public.salary_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "salrule authed all" ON public.salary_rules;
CREATE POLICY "salrule authed all" ON public.salary_rules FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS trg_salrule_uat ON public.salary_rules;
CREATE TRIGGER trg_salrule_uat BEFORE UPDATE ON public.salary_rules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.worker_transactions (
  id text PRIMARY KEY,
  firm_id uuid,
  worker_id text NOT NULL,
  kind text NOT NULL,
  ts timestamptz NOT NULL DEFAULT now(),
  amount_paise bigint NOT NULL DEFAULT 0,
  gold_mg bigint NOT NULL DEFAULT 0,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.worker_transactions TO authenticated;
GRANT ALL ON public.worker_transactions TO service_role;
ALTER TABLE public.worker_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wtx authed all" ON public.worker_transactions;
CREATE POLICY "wtx authed all" ON public.worker_transactions FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS trg_wtx_uat ON public.worker_transactions;
CREATE TRIGGER trg_wtx_uat BEFORE UPDATE ON public.worker_transactions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.worker_settlements (
  id text PRIMARY KEY,
  firm_id uuid,
  worker_id text NOT NULL,
  period_from date,
  period_to date,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.worker_settlements TO authenticated;
GRANT ALL ON public.worker_settlements TO service_role;
ALTER TABLE public.worker_settlements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wset authed all" ON public.worker_settlements;
CREATE POLICY "wset authed all" ON public.worker_settlements FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS trg_wset_uat ON public.worker_settlements;
CREATE TRIGGER trg_wset_uat BEFORE UPDATE ON public.worker_settlements FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============== ORDERS & JOB CARDS ===================================
CREATE TABLE IF NOT EXISTS public.orders (
  id text PRIMARY KEY,
  firm_id uuid,
  order_no text NOT NULL,
  type text NOT NULL,
  status text NOT NULL,
  customer_id text REFERENCES public.people(id) ON DELETE SET NULL,
  karigar_id text REFERENCES public.people(id) ON DELETE SET NULL,
  expected_delivery date,
  priority text NOT NULL DEFAULT 'normal',
  source text NOT NULL DEFAULT 'manual',
  whatsapp_source_id text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "orders authed all" ON public.orders;
CREATE POLICY "orders authed all" ON public.orders FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS trg_orders_uat ON public.orders;
CREATE TRIGGER trg_orders_uat BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.job_cards (
  id text PRIMARY KEY,
  firm_id uuid,
  job_no text NOT NULL,
  order_id text REFERENCES public.orders(id) ON DELETE SET NULL,
  karigar_id text REFERENCES public.people(id) ON DELETE SET NULL,
  status text NOT NULL,
  template_key text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_cards TO authenticated;
GRANT ALL ON public.job_cards TO service_role;
ALTER TABLE public.job_cards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "jc authed all" ON public.job_cards;
CREATE POLICY "jc authed all" ON public.job_cards FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS trg_jc_uat ON public.job_cards;
CREATE TRIGGER trg_jc_uat BEFORE UPDATE ON public.job_cards FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.job_process_steps (
  id text PRIMARY KEY,
  job_id text NOT NULL REFERENCES public.job_cards(id) ON DELETE CASCADE,
  firm_id uuid,
  ordinal int NOT NULL,
  name text NOT NULL,
  status text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_process_steps TO authenticated;
GRANT ALL ON public.job_process_steps TO service_role;
ALTER TABLE public.job_process_steps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "jps authed all" ON public.job_process_steps;
CREATE POLICY "jps authed all" ON public.job_process_steps FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS trg_jps_uat ON public.job_process_steps;
CREATE TRIGGER trg_jps_uat BEFORE UPDATE ON public.job_process_steps FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============== CATALOG / STOCK ======================================
CREATE TABLE IF NOT EXISTS public.catalog_designs (
  id text PRIMARY KEY,
  firm_id uuid,
  design_no text,
  name text NOT NULL,
  category text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalog_designs TO authenticated;
GRANT ALL ON public.catalog_designs TO service_role;
ALTER TABLE public.catalog_designs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cat authed all" ON public.catalog_designs;
CREATE POLICY "cat authed all" ON public.catalog_designs FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS trg_cat_uat ON public.catalog_designs;
CREATE TRIGGER trg_cat_uat BEFORE UPDATE ON public.catalog_designs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.inventory (
  id text PRIMARY KEY,
  firm_id uuid,
  item_code text,
  barcode text,
  huid text,
  item_name text NOT NULL,
  category text,
  purity smallint,
  gross_mg bigint NOT NULL DEFAULT 0,
  net_mg bigint NOT NULL DEFAULT 0,
  status text NOT NULL,
  location text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory TO authenticated;
GRANT ALL ON public.inventory TO service_role;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "inv authed all" ON public.inventory;
CREATE POLICY "inv authed all" ON public.inventory FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS trg_inv_uat ON public.inventory;
CREATE TRIGGER trg_inv_uat BEFORE UPDATE ON public.inventory FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.stock_movements (
  id text PRIMARY KEY,
  firm_id uuid,
  item_id text REFERENCES public.inventory(id) ON DELETE SET NULL,
  ts timestamptz NOT NULL DEFAULT now(),
  kind text NOT NULL,
  from_location text,
  to_location text,
  note text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "smv authed all" ON public.stock_movements;
CREATE POLICY "smv authed all" ON public.stock_movements FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS trg_smv_uat ON public.stock_movements;
CREATE TRIGGER trg_smv_uat BEFORE UPDATE ON public.stock_movements FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============== BILLING ==============================================
CREATE TABLE IF NOT EXISTS public.invoices (
  id text PRIMARY KEY,
  firm_id uuid,
  invoice_no text NOT NULL,
  customer_id text REFERENCES public.people(id) ON DELETE SET NULL,
  order_id text REFERENCES public.orders(id) ON DELETE SET NULL,
  status text NOT NULL,
  gst text NOT NULL,
  subtotal_paise bigint NOT NULL DEFAULT 0,
  cgst_paise bigint NOT NULL DEFAULT 0,
  sgst_paise bigint NOT NULL DEFAULT 0,
  gst_paise bigint NOT NULL DEFAULT 0,
  adjustment_paise bigint NOT NULL DEFAULT 0,
  grand_total_paise bigint NOT NULL DEFAULT 0,
  paid_paise bigint NOT NULL DEFAULT 0,
  balance_paise bigint NOT NULL DEFAULT 0,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "inv2 authed all" ON public.invoices;
CREATE POLICY "inv2 authed all" ON public.invoices FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS trg_inv2_uat ON public.invoices;
CREATE TRIGGER trg_inv2_uat BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.payments (
  id text PRIMARY KEY,
  firm_id uuid,
  invoice_id text REFERENCES public.invoices(id) ON DELETE CASCADE,
  ts timestamptz NOT NULL DEFAULT now(),
  mode text NOT NULL,
  amount_paise bigint NOT NULL DEFAULT 0,
  reference text,
  notes text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pay authed all" ON public.payments;
CREATE POLICY "pay authed all" ON public.payments FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS trg_pay_uat ON public.payments;
CREATE TRIGGER trg_pay_uat BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.customer_ledger (
  id text PRIMARY KEY,
  firm_id uuid,
  customer_id text REFERENCES public.people(id) ON DELETE CASCADE,
  ts timestamptz NOT NULL DEFAULT now(),
  kind text NOT NULL,
  ref text,
  description text,
  debit_paise bigint NOT NULL DEFAULT 0,
  credit_paise bigint NOT NULL DEFAULT 0,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_ledger TO authenticated;
GRANT ALL ON public.customer_ledger TO service_role;
ALTER TABLE public.customer_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cled authed all" ON public.customer_ledger;
CREATE POLICY "cled authed all" ON public.customer_ledger FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS trg_cled_uat ON public.customer_ledger;
CREATE TRIGGER trg_cled_uat BEFORE UPDATE ON public.customer_ledger FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.rate_cut_records (
  id text PRIMARY KEY,
  firm_id uuid,
  rate_cut_no text NOT NULL,
  karigar_id text REFERENCES public.people(id) ON DELETE SET NULL,
  job_id text REFERENCES public.job_cards(id) ON DELETE SET NULL,
  overloss_fine_mg bigint NOT NULL DEFAULT 0,
  gold_rate_per_gram_paise bigint NOT NULL DEFAULT 0,
  penalty_paise bigint NOT NULL DEFAULT 0,
  settlement_mode text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rate_cut_records TO authenticated;
GRANT ALL ON public.rate_cut_records TO service_role;
ALTER TABLE public.rate_cut_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rc authed all" ON public.rate_cut_records;
CREATE POLICY "rc authed all" ON public.rate_cut_records FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS trg_rc_uat ON public.rate_cut_records;
CREATE TRIGGER trg_rc_uat BEFORE UPDATE ON public.rate_cut_records FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============== REPAIR ===============================================
CREATE TABLE IF NOT EXISTS public.repairs (
  id text PRIMARY KEY,
  firm_id uuid,
  repair_no text NOT NULL,
  customer_id text REFERENCES public.people(id) ON DELETE SET NULL,
  kind text NOT NULL,
  status text NOT NULL,
  received_gross_mg bigint NOT NULL DEFAULT 0,
  estimated_charge_paise bigint NOT NULL DEFAULT 0,
  advance_paise bigint NOT NULL DEFAULT 0,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.repairs TO authenticated;
GRANT ALL ON public.repairs TO service_role;
ALTER TABLE public.repairs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rep authed all" ON public.repairs;
CREATE POLICY "rep authed all" ON public.repairs FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS trg_rep_uat ON public.repairs;
CREATE TRIGGER trg_rep_uat BEFORE UPDATE ON public.repairs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============== DAILY CLOSE =========================================
CREATE TABLE IF NOT EXISTS public.daily_close (
  id text PRIMARY KEY,
  firm_id uuid,
  date date NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_close TO authenticated;
GRANT ALL ON public.daily_close TO service_role;
ALTER TABLE public.daily_close ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dc authed all" ON public.daily_close;
CREATE POLICY "dc authed all" ON public.daily_close FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS trg_dc_uat ON public.daily_close;
CREATE TRIGGER trg_dc_uat BEFORE UPDATE ON public.daily_close FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============== PRINT LOGS ==========================================
CREATE TABLE IF NOT EXISTS public.print_logs (
  id text PRIMARY KEY,
  firm_id uuid,
  doc_type text NOT NULL,
  doc_number text NOT NULL,
  linked_id text,
  linked_label text,
  printed_by text,
  first_printed_at timestamptz NOT NULL DEFAULT now(),
  last_printed_at timestamptz NOT NULL DEFAULT now(),
  reprint_count int NOT NULL DEFAULT 0,
  history jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.print_logs TO authenticated;
GRANT ALL ON public.print_logs TO service_role;
ALTER TABLE public.print_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "plog authed all" ON public.print_logs;
CREATE POLICY "plog authed all" ON public.print_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS trg_plog_uat ON public.print_logs;
CREATE TRIGGER trg_plog_uat BEFORE UPDATE ON public.print_logs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============== WHATSAPP INBOX ======================================
CREATE TABLE IF NOT EXISTS public.whatsapp_inbox (
  id text PRIMARY KEY,
  firm_id uuid,
  sender_name text,
  sender_phone text,
  raw_text text NOT NULL,
  status text NOT NULL,
  parsed jsonb,
  converted_order_id text REFERENCES public.orders(id) ON DELETE SET NULL,
  linked_person_id text REFERENCES public.people(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_inbox TO authenticated;
GRANT ALL ON public.whatsapp_inbox TO service_role;
ALTER TABLE public.whatsapp_inbox ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wa authed all" ON public.whatsapp_inbox;
CREATE POLICY "wa authed all" ON public.whatsapp_inbox FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS trg_wa_uat ON public.whatsapp_inbox;
CREATE TRIGGER trg_wa_uat BEFORE UPDATE ON public.whatsapp_inbox FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.print_logs
  ADD COLUMN IF NOT EXISTS data jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.whatsapp_inbox
  ADD COLUMN IF NOT EXISTS data jsonb NOT NULL DEFAULT '{}'::jsonb;

-- ============== SETTINGS / DROPDOWN MASTERS =========================
CREATE TABLE IF NOT EXISTS public.app_settings (
  id text PRIMARY KEY,
  firm_id uuid,
  scope text NOT NULL DEFAULT 'firm',
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "set authed all" ON public.app_settings;
CREATE POLICY "set authed all" ON public.app_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS trg_set_uat ON public.app_settings;
CREATE TRIGGER trg_set_uat BEFORE UPDATE ON public.app_settings FOR EACH ROW EXECUTE FUNCTION public.set_update…9551 tokens truncated…_billing_documents.sql
-- Description: Credit Notes, Debit Notes, Estimates, and Delivery Challans â€”
-- the four billing document types billing-documents-store.ts implements but
-- that had no backing Supabase tables, so every issue()/create() call would
-- fail with "relation does not exist".

CREATE TABLE IF NOT EXISTS public.credit_notes (
  id          TEXT PRIMARY KEY,
  branch_id   TEXT,
  invoice_id  TEXT,
  customer_id TEXT,
  status      TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'cancelled')),
  data        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.credit_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "credit_notes_branch_isolation" ON public.credit_notes;
DROP POLICY IF EXISTS "credit_notes_branch_isolation" ON public.credit_notes;
CREATE POLICY "credit_notes_branch_isolation" ON public.credit_notes
  FOR ALL TO authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_credit_notes_invoice ON public.credit_notes(invoice_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_branch ON public.credit_notes(branch_id);

CREATE TABLE IF NOT EXISTS public.debit_notes (
  id          TEXT PRIMARY KEY,
  branch_id   TEXT,
  invoice_id  TEXT,
  customer_id TEXT,
  status      TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'cancelled')),
  data        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.debit_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "debit_notes_branch_isolation" ON public.debit_notes;
DROP POLICY IF EXISTS "debit_notes_branch_isolation" ON public.debit_notes;
CREATE POLICY "debit_notes_branch_isolation" ON public.debit_notes
  FOR ALL TO authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_debit_notes_invoice ON public.debit_notes(invoice_id);
CREATE INDEX IF NOT EXISTS idx_debit_notes_branch ON public.debit_notes(branch_id);

CREATE TABLE IF NOT EXISTS public.estimates (
  id          TEXT PRIMARY KEY,
  branch_id   TEXT,
  customer_id TEXT,
  status      TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'converted', 'expired', 'cancelled')),
  data        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.estimates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "estimates_branch_isolation" ON public.estimates;
DROP POLICY IF EXISTS "estimates_branch_isolation" ON public.estimates;
CREATE POLICY "estimates_branch_isolation" ON public.estimates
  FOR ALL TO authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_estimates_customer ON public.estimates(customer_id);
CREATE INDEX IF NOT EXISTS idx_estimates_branch ON public.estimates(branch_id);
CREATE INDEX IF NOT EXISTS idx_estimates_status ON public.estimates(status);

CREATE TABLE IF NOT EXISTS public.delivery_challans (
  id          TEXT PRIMARY KEY,
  branch_id   TEXT,
  customer_id TEXT,
  status      TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'returned', 'converted_to_invoice', 'cancelled')),
  data        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.delivery_challans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "delivery_challans_branch_isolation" ON public.delivery_challans;
DROP POLICY IF EXISTS "delivery_challans_branch_isolation" ON public.delivery_challans;
CREATE POLICY "delivery_challans_branch_isolation" ON public.delivery_challans
  FOR ALL TO authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_delivery_challans_customer ON public.delivery_challans(customer_id);
CREATE INDEX IF NOT EXISTS idx_delivery_challans_branch ON public.delivery_challans(branch_id);
CREATE INDEX IF NOT EXISTS idx_delivery_challans_status ON public.delivery_challans(status);


-- Migration: 20260704000000_order_issues_and_worker_returns.sql
-- Description: Worker Return workflow (worker-return-store.ts) â€” records
-- material/gold handed back by a worker against a Production Order.
--
-- NOTE: order_issues already has its own applied migration
-- (see remote migration history: add_order_gold_material_issues /
-- add_order_issues_structured_columns) â€” not recreated here.
--
-- NOTE on RLS: this project's real, currently-applied policies use a plain
-- "authenticated user" gate (`auth.uid() IS NOT NULL`), not the
-- get_user_branch_ids()/is_global_user() branch-scoping functions used by
-- some other local migration files in this folder â€” those functions do not
-- exist in the live database. Branch scoping for these tables is enforced
-- at the application query layer instead (see supabase-write.ts /
-- stock-store.ts's own `data->>branchId` filters), matching how
-- order_issues' own real policy already works. This migration was applied
-- for real via the Supabase migration tool, not just written to this file.
CREATE TABLE IF NOT EXISTS public.worker_returns (
  id          TEXT PRIMARY KEY,
  branch_id   TEXT,
  order_id    TEXT NOT NULL,
  worker_id   TEXT,
  data        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.worker_returns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "worker_returns_authenticated_rw" ON public.worker_returns;
DROP POLICY IF EXISTS "worker_returns_authenticated_rw" ON public.worker_returns;
CREATE POLICY "worker_returns_authenticated_rw" ON public.worker_returns
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_worker_returns_order ON public.worker_returns(order_id);
CREATE INDEX IF NOT EXISTS idx_worker_returns_worker ON public.worker_returns(worker_id);


-- Migration: 20260705000000_outside_work_transactions.sql
-- Description: Outside Work (External Jeweller) workflow
-- (outside-work-store.ts) â€” records gold/material issued to and received
-- from external jewellers (chain makers, ball makers, KDM suppliers), keyed
-- by an optional order_id (Production Order link is optional in this
-- workflow) and worker_id (reused column, holds the outside jeweller's
-- person id).
--
-- Applied for real via the Supabase migration tool (not just written to
-- this file). RLS follows the same real, currently-applied pattern as
-- order_issues/worker_returns: a plain authenticated-user gate, not the
-- get_user_branch_ids()/is_global_user() functions (which do not exist in
-- the live database) used by some older local migration files in this
-- folder. Branch scoping is enforced at the application query layer.
CREATE TABLE IF NOT EXISTS public.outside_work_transactions (
  id          TEXT PRIMARY KEY,
  branch_id   TEXT,
  order_id    TEXT,
  worker_id   TEXT,
  data        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.outside_work_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "outside_work_transactions_authenticated_rw" ON public.outside_work_transactions;
DROP POLICY IF EXISTS "outside_work_transactions_authenticated_rw" ON public.outside_work_transactions;
CREATE POLICY "outside_work_transactions_authenticated_rw" ON public.outside_work_transactions
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_outside_work_transactions_order ON public.outside_work_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_outside_work_transactions_worker ON public.outside_work_transactions(worker_id);


-- Migration: 20260705010000_outside_work_labour_and_payments.sql
-- Description: Outside Work Labour, Billing & Payment tracking
-- (outside-work-labour-store.ts) â€” labour charges billed by external
-- jewellers and payments made against them. Settlement itself reuses the
-- existing gold_settlements table (see gold-settlement-store.ts /
-- supabase-services.ts's GoldSettlementRecord, extended with
-- "outside_work_gold_settlement"/"outside_work_labour_settlement" types and
-- an optional labour_component_paise field carried inside the JSONB `data`
-- column â€” no new table needed for settlements).
--
-- Applied for real via the Supabase migration tool. Same real RLS pattern
-- as every other outside-work-*/order_issues/worker_returns table in this
-- folder: a plain authenticated-user gate, not the
-- get_user_branch_ids()/is_global_user() functions (which do not exist in
-- the live database).
CREATE TABLE IF NOT EXISTS public.outside_work_labour_charges (
  id          TEXT PRIMARY KEY,
  branch_id   TEXT,
  order_id    TEXT,
  worker_id   TEXT,
  data        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.outside_work_labour_charges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "outside_work_labour_charges_authenticated_rw" ON public.outside_work_labour_charges;
DROP POLICY IF EXISTS "outside_work_labour_charges_authenticated_rw" ON public.outside_work_labour_charges;
CREATE POLICY "outside_work_labour_charges_authenticated_rw" ON public.outside_work_labour_charges
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_outside_work_labour_charges_order ON public.outside_work_labour_charges(order_id);
CREATE INDEX IF NOT EXISTS idx_outside_work_labour_charges_worker ON public.outside_work_labour_charges(worker_id);

CREATE TABLE IF NOT EXISTS public.outside_work_payments (
  id          TEXT PRIMARY KEY,
  branch_id   TEXT,
  order_id    TEXT,
  worker_id   TEXT,
  data        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.outside_work_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "outside_work_payments_authenticated_rw" ON public.outside_work_payments;
DROP POLICY IF EXISTS "outside_work_payments_authenticated_rw" ON public.outside_work_payments;
CREATE POLICY "outside_work_payments_authenticated_rw" ON public.outside_work_payments
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_outside_work_payments_order ON public.outside_work_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_outside_work_payments_worker ON public.outside_work_payments(worker_id);


-- Migration: 20260707000000_customer_settlements.sql
-- Description: Customer Settlement Draft â†’ Delivery â†’ Final Settlement
-- lifecycle (settlement-store.ts). Deliberately its own table, distinct
-- from gold_settlements (used for worker/vendor/outside-work settlements)
-- and from invoices (a Settlement generates an Invoice only at Final
-- Settlement â€” see completeFinalSettlement()).
--
-- Applied for real via the Supabase migration tool. Same real RLS pattern
-- as every other additive table in this folder: a plain authenticated-user
-- gate, not the get_user_branch_ids()/is_global_user() functions (which do
-- not exist in the live database).
CREATE TABLE IF NOT EXISTS public.customer_settlements (
  id          TEXT PRIMARY KEY,
  branch_id   TEXT,
  order_id    TEXT,
  worker_id   TEXT,
  data        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.customer_settlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customer_settlements_authenticated_rw" ON public.customer_settlements;
DROP POLICY IF EXISTS "customer_settlements_authenticated_rw" ON public.customer_settlements;
CREATE POLICY "customer_settlements_authenticated_rw" ON public.customer_settlements
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_customer_settlements_order ON public.customer_settlements(order_id);

-- =====================================================================
-- Owner-managed Hybrid provider schema (structured data only)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.document_sequences (
  type text NOT NULL,
  prefix text NOT NULL,
  last_value integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (type, prefix)
);

CREATE OR REPLACE FUNCTION public.generate_sequential_number(p_type text, p_prefix text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE next_value integer;
BEGIN
  INSERT INTO public.document_sequences(type, prefix, last_value)
  VALUES (p_type, p_prefix, 1)
  ON CONFLICT (type, prefix) DO UPDATE
    SET last_value = public.document_sequences.last_value + 1, updated_at = now()
  RETURNING last_value INTO next_value;
  RETURN p_prefix || lpad(next_value::text, 3, '0');
END;
$$;

CREATE TABLE IF NOT EXISTS public.branches (
  id text PRIMARY KEY,
  name text,
  short_name text,
  branch_type text,
  city text,
  state text,
  gstin text,
  phone text,
  email text,
  address text,
  logo_url text,
  invoice_prefix text,
  barcode_prefix text,
  active boolean NOT NULL DEFAULT true,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workshops (
  id text PRIMARY KEY,
  branch_id text REFERENCES public.branches(id) ON DELETE SET NULL,
  name text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.branch_settings (
  branch_id text PRIMARY KEY,
  address text, phone text, email text, gstin text,
  invoice_series text, receipt_series text, barcode_series text,
  smtp_host text, smtp_port text, smtp_user text, smtp_password text,
  smtp_from_name text, smtp_from_email text, wa_phone_number text,
  thermal_printer_ip text, thermal_printer_port text,
  default_karat text, gold_rate_source text,
  invoice_template_id text, receipt_template_id text,
  logo_url text, logo_storage_path text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.comm_provider_settings (
  id text PRIMARY KEY,
  branch_id text REFERENCES public.branches(id) ON DELETE SET NULL,
  channel text, provider_type text, is_active boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 0,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.melt_jobs (
  id text PRIMARY KEY,
  data jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.crm_leads_opportunities (
  id text PRIMARY KEY,
  branch_id text,
  person_id text,
  lead_name text,
  stage text,
  priority text,
  estimated_value_paise bigint NOT NULL DEFAULT 0,
  target_gold_mg bigint NOT NULL DEFAULT 0,
  assigned_staff_email text,
  follow_up_date date,
  last_contacted_at timestamptz,
  remarks text,
  source text NOT NULL DEFAULT 'unknown',
  buyer_type text NOT NULL DEFAULT 'individual',
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.crm_tasks_meetings (
  id text PRIMARY KEY, branch_id text, person_id text, opportunity_id text,
  title text, type text, status text, priority text, due_date timestamptz,
  assigned_staff_email text, description text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.crm_interactions (
  id text PRIMARY KEY, branch_id text, person_id text, opportunity_id text,
  type text, title text, body text, staff_email text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.module_states (
  id text PRIMARY KEY, branch_id text, module_key text, enabled boolean NOT NULL DEFAULT true,
  data jsonb NOT NULL DEFAULT '{}'::jsonb, updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(branch_id, module_key)
);
CREATE TABLE IF NOT EXISTS public.dropdown_masters (
  id text PRIMARY KEY, master_key text, value text, sort_order integer,
  active boolean NOT NULL DEFAULT true, data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.financial_lock_periods (
  id text PRIMARY KEY, branch_id text, period text, data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(branch_id, period)
);
CREATE TABLE IF NOT EXISTS public.physical_stock_counts (
  id text PRIMARY KEY, branch_id text, status text, data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.stock_lots (
  id text PRIMARY KEY, branch_id text, lot_number text, status text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(branch_id, lot_number)
);
CREATE TABLE IF NOT EXISTS public.stock_stones (
  id text PRIMARY KEY, branch_id text, item_id text, stone_type text, certificate_number text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.hallmark_batches (
  id text PRIMARY KEY, branch_id text, batch_number text, status text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(branch_id, batch_number)
);
CREATE TABLE IF NOT EXISTS public.order_issues (
  id text PRIMARY KEY, branch_id text, order_id text, worker_id text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_financial_locks_branch ON public.financial_lock_periods(branch_id);
CREATE INDEX IF NOT EXISTS idx_stock_lots_branch ON public.stock_lots(branch_id);
CREATE INDEX IF NOT EXISTS idx_stock_stones_item ON public.stock_stones(item_id);
CREATE INDEX IF NOT EXISTS idx_hallmark_batches_branch ON public.hallmark_batches(branch_id);

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


ALTER TABLE public.manufacturing_bills
  ADD COLUMN IF NOT EXISTS extra_data JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Migration: 20260710000000_crm_leads_source_and_buyer_type.sql
-- Description: AVS-102 â€” Lead Source + Buyer Type on crm_leads_opportunities.
-- Real, structured columns (not folded into the existing `data` JSONB bag)
-- because reporting needs to filter/group by both â€” the opposite reasoning
-- from 20260706000000's manufacturing_bills.extra_data, which is JSONB
-- specifically because nothing there is ever filtered/queried on directly.
-- DEFAULT 'unknown' so every pre-existing row (and any insert that doesn't
-- set these explicitly) has a real, queryable value rather than NULL.
--
-- Applied for real via the Supabase migration tool â€” not run by writing
-- this file.
ALTER TABLE public.crm_leads_opportunities
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'unknown'
    CHECK (source IN ('whatsapp', 'instagram', 'facebook', 'walk_in', 'referral', 'phone_call', 'unknown')),
  ADD COLUMN IF NOT EXISTS buyer_type TEXT NOT NULL DEFAULT 'individual'
    CHECK (buyer_type IN ('individual', 'retailer', 'bulk_buyer'));

CREATE TABLE IF NOT EXISTS public.gold_settlements (
  id text PRIMARY KEY,
  firm_id uuid,
  settlement_date timestamptz NOT NULL DEFAULT now(),
  party_type text NOT NULL,
  party_id text NOT NULL,
  branch_id text,
  settlement_type text NOT NULL,
  purity smallint NOT NULL DEFAULT 916 CHECK (purity BETWEEN 1 AND 1000),
  gross_mg bigint NOT NULL DEFAULT 0,
  net_mg bigint NOT NULL DEFAULT 0,
  wastage_mg bigint NOT NULL DEFAULT 0,
  rate_per_gram_paise bigint NOT NULL DEFAULT 0,
  amount_paise bigint NOT NULL DEFAULT 0,
  payment_mode text,
  notes text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gold_settlements_branch ON public.gold_settlements(branch_id);
CREATE INDEX IF NOT EXISTS idx_gold_settlements_party ON public.gold_settlements(party_type, party_id);
DROP TRIGGER IF EXISTS trg_gset_uat ON public.gold_settlements;
DROP TRIGGER IF EXISTS trg_gset_uat ON public.gold_settlements;
CREATE TRIGGER trg_gset_uat BEFORE UPDATE ON public.gold_settlements
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.communication_logs (
  id text PRIMARY KEY,
  channel text,
  direction text,
  status text,
  phone text,
  body text,
  linked_id text,
  linked_table text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.approval_requests (
  id text PRIMARY KEY,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.lot_batches (
  id text PRIMARY KEY, data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.manufacturing_barcodes (
  id text PRIMARY KEY, data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.material_vault_movements (
  id text PRIMARY KEY, branch_id text, data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.polishing_transactions (
  id text PRIMARY KEY, branch_id text, data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.print_templates (
  id text PRIMARY KEY, data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.saved_filters (
  id text PRIMARY KEY, data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.stone_details (
  id text PRIMARY KEY, branch_id text, data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
-- Owner-managed Hybrid uses a dedicated customer project. Runtime possession
-- of that project's anon key authorizes this single-tenant synchronization API.
-- RLS remains enabled and Data API grants are explicit for 2026+ projects.
DO $policy$
DECLARE
  table_name text;
  managed_tables text[] := ARRAY[
    'erp_schema_meta','people','gold_ledger','attendance','salary_rules',
    'worker_transactions','worker_settlements','catalog_designs','job_process_steps',
    'orders','job_cards','inventory','stock_movements','invoices','payments',
    'customer_ledger','rate_cut_records','repairs','daily_close','print_logs',
    'whatsapp_inbox','app_settings','dropdown_masters','document_sequences',
    'branches','workshops','branch_settings','comm_provider_settings',
    'communication_logs','manufacturing_bills','melt_jobs','crm_leads_opportunities',
    'crm_tasks_meetings','crm_interactions','module_states','financial_lock_periods',
    'physical_stock_counts','stock_lots','stock_stones','hallmark_batches',
    'credit_notes','debit_notes','estimates','delivery_challans','order_issues','worker_returns',
    'outside_work_transactions','outside_work_labour_charges','outside_work_payments',
    'customer_settlements','gold_settlements','approval_requests','lot_batches',
    'manufacturing_barcodes','material_vault_movements','polishing_transactions',
    'print_templates','saved_filters','stone_details'
  ];
BEGIN
  FOREACH table_name IN ARRAY managed_tables LOOP
    IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
      EXECUTE format('DROP POLICY IF EXISTS hybrid_runtime_access ON public.%I', table_name);
      EXECUTE format(
        'CREATE POLICY hybrid_runtime_access ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)',
        table_name
      );
      EXECUTE format(
        'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO anon, authenticated, service_role',
        table_name
      );
    END IF;
  END LOOP;
END
$policy$;

-- ============== SUPPLEMENTARY PERFORMANCE INDEXES =====================
-- Hot lookup/filter/FK columns on high-traffic tables that predate the
-- indexed tables added later in this file. IF NOT EXISTS keeps this
-- idempotent against re-running the master SQL on an already-initialized
-- project.
CREATE INDEX IF NOT EXISTS idx_people_full_name ON public.people(full_name);
CREATE INDEX IF NOT EXISTS idx_gold_ledger_ts ON public.gold_ledger(ts DESC);
CREATE INDEX IF NOT EXISTS idx_gold_ledger_movement ON public.gold_ledger(movement);
CREATE INDEX IF NOT EXISTS idx_attendance_worker ON public.attendance(worker_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance(date);
CREATE INDEX IF NOT EXISTS idx_worker_transactions_worker ON public.worker_transactions(worker_id);
CREATE INDEX IF NOT EXISTS idx_worker_transactions_ts ON public.worker_transactions(ts DESC);
CREATE INDEX IF NOT EXISTS idx_worker_settlements_worker ON public.worker_settlements(worker_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_karigar ON public.orders(karigar_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_order_no ON public.orders(order_no);
CREATE INDEX IF NOT EXISTS idx_job_cards_order ON public.job_cards(order_id);
CREATE INDEX IF NOT EXISTS idx_job_cards_status ON public.job_cards(status);
CREATE INDEX IF NOT EXISTS idx_inventory_status ON public.inventory(status);
CREATE INDEX IF NOT EXISTS idx_inventory_barcode ON public.inventory(barcode);
CREATE INDEX IF NOT EXISTS idx_stock_movements_item ON public.stock_movements(item_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON public.invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON public.invoices(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON public.payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_customer_ledger_customer ON public.customer_ledger(customer_id);
CREATE INDEX IF NOT EXISTS idx_repairs_customer ON public.repairs(customer_id);
CREATE INDEX IF NOT EXISTS idx_repairs_status ON public.repairs(status);
CREATE INDEX IF NOT EXISTS idx_print_logs_linked ON public.print_logs(linked_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_inbox_sender_phone ON public.whatsapp_inbox(sender_phone);
CREATE INDEX IF NOT EXISTS idx_communication_logs_linked ON public.communication_logs(linked_id);

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.generate_sequential_number(text, text) TO anon, authenticated, service_role;

INSERT INTO public.erp_schema_meta
  (id, schema_version, product, deployment_model, metadata)
VALUES
  ('avs-gold-erp', 1, 'AVS Gold ERP', 'owner-managed-hybrid',
   '{"files":"local-only","cloud":"structured-data-only","master_migration":true}'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  schema_version = EXCLUDED.schema_version,
  product = EXCLUDED.product,
  deployment_model = EXCLUDED.deployment_model,
  metadata = EXCLUDED.metadata,
  applied_at = now();

COMMIT;
