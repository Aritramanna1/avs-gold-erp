-- Migration: 20260703040000_billing_documents.sql
-- Description: Credit Notes, Debit Notes, Estimates, and Delivery Challans —
-- the four billing document types billing-documents-store.ts implements but
-- that had no backing Supabase tables, so every issue()/create() call would
-- fail with "relation does not exist".

CREATE TABLE IF NOT EXISTS public.credit_notes (
  id          TEXT PRIMARY KEY,
  branch_id   TEXT REFERENCES public.branches(id) ON DELETE SET NULL,
  invoice_id  TEXT,
  customer_id TEXT,
  status      TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'cancelled')),
  data        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.credit_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "credit_notes_branch_isolation" ON public.credit_notes;
CREATE POLICY "credit_notes_branch_isolation" ON public.credit_notes
  FOR ALL TO authenticated USING (
    branch_id IS NULL OR branch_id = ANY(public.get_user_branch_ids()) OR public.is_global_user()
  );
CREATE INDEX IF NOT EXISTS idx_credit_notes_invoice ON public.credit_notes(invoice_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_branch ON public.credit_notes(branch_id);

CREATE TABLE IF NOT EXISTS public.debit_notes (
  id          TEXT PRIMARY KEY,
  branch_id   TEXT REFERENCES public.branches(id) ON DELETE SET NULL,
  invoice_id  TEXT,
  customer_id TEXT,
  status      TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'cancelled')),
  data        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.debit_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "debit_notes_branch_isolation" ON public.debit_notes;
CREATE POLICY "debit_notes_branch_isolation" ON public.debit_notes
  FOR ALL TO authenticated USING (
    branch_id IS NULL OR branch_id = ANY(public.get_user_branch_ids()) OR public.is_global_user()
  );
CREATE INDEX IF NOT EXISTS idx_debit_notes_invoice ON public.debit_notes(invoice_id);
CREATE INDEX IF NOT EXISTS idx_debit_notes_branch ON public.debit_notes(branch_id);

CREATE TABLE IF NOT EXISTS public.estimates (
  id          TEXT PRIMARY KEY,
  branch_id   TEXT REFERENCES public.branches(id) ON DELETE SET NULL,
  customer_id TEXT,
  status      TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'converted', 'expired', 'cancelled')),
  data        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.estimates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "estimates_branch_isolation" ON public.estimates;
CREATE POLICY "estimates_branch_isolation" ON public.estimates
  FOR ALL TO authenticated USING (
    branch_id IS NULL OR branch_id = ANY(public.get_user_branch_ids()) OR public.is_global_user()
  );
CREATE INDEX IF NOT EXISTS idx_estimates_customer ON public.estimates(customer_id);
CREATE INDEX IF NOT EXISTS idx_estimates_branch ON public.estimates(branch_id);
CREATE INDEX IF NOT EXISTS idx_estimates_status ON public.estimates(status);

CREATE TABLE IF NOT EXISTS public.delivery_challans (
  id          TEXT PRIMARY KEY,
  branch_id   TEXT REFERENCES public.branches(id) ON DELETE SET NULL,
  customer_id TEXT,
  status      TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'returned', 'converted_to_invoice', 'cancelled')),
  data        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.delivery_challans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "delivery_challans_branch_isolation" ON public.delivery_challans;
CREATE POLICY "delivery_challans_branch_isolation" ON public.delivery_challans
  FOR ALL TO authenticated USING (
    branch_id IS NULL OR branch_id = ANY(public.get_user_branch_ids()) OR public.is_global_user()
  );
CREATE INDEX IF NOT EXISTS idx_delivery_challans_customer ON public.delivery_challans(customer_id);
CREATE INDEX IF NOT EXISTS idx_delivery_challans_branch ON public.delivery_challans(branch_id);
CREATE INDEX IF NOT EXISTS idx_delivery_challans_status ON public.delivery_challans(status);
