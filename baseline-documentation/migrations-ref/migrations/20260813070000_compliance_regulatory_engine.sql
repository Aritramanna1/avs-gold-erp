-- Ornexa ERP — Compliance & Regulatory Engine Tables (Section 70)
-- Creates GST configuration, HSN/SAC, hallmark, e-invoice, e-way bill, and compliance rule versioning tables.
-- All tables are firm-scoped with RLS for multi-tenant isolation.

-- ============================================================
-- A. Compliance Rule Versioning (Section 70-T)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.compliance_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL DEFAULT public.my_firm_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  rule_code TEXT NOT NULL,
  rule_name TEXT NOT NULL,
  authority TEXT NOT NULL DEFAULT 'CBIC',           -- CBIC, BIS, State, Custom
  category TEXT NOT NULL DEFAULT 'gst',             -- gst, hallmark, tds_tcs, eway, einvoice, other
  description TEXT,
  threshold_value NUMERIC,
  threshold_unit TEXT,                               -- 'inr', 'grams', 'pieces', 'km'
  rule_data JSONB NOT NULL DEFAULT '{}'::jsonb,      -- flexible rule parameters
  is_system BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_compliance_rule_code_firm UNIQUE (firm_id, rule_code)
);

CREATE TABLE IF NOT EXISTS public.compliance_rule_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES public.compliance_rules(id) ON DELETE CASCADE,
  firm_id UUID NOT NULL DEFAULT public.my_firm_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  version_number INT NOT NULL DEFAULT 1,
  effective_from DATE NOT NULL,
  effective_to DATE,
  parameters JSONB NOT NULL DEFAULT '{}'::jsonb,     -- versioned rule params (rates, thresholds)
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'superseded', 'archived')),
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_rule_version UNIQUE (rule_id, version_number)
);

-- ============================================================
-- B. HSN / SAC Code Master (Section 70-C)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.hsn_sac_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL DEFAULT public.my_firm_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  code TEXT NOT NULL,                                -- e.g. '7113', '7108', '998346'
  code_type TEXT NOT NULL DEFAULT 'hsn'
    CHECK (code_type IN ('hsn', 'sac')),
  description TEXT NOT NULL,
  category TEXT,                                     -- 'metals', 'jewellery', 'diamonds', 'making_charges', 'hallmark_service', 'refining', 'job_work'
  default_gst_rate NUMERIC(5,2) NOT NULL DEFAULT 3.00,
  linked_rule_id UUID REFERENCES public.compliance_rules(id) ON DELETE SET NULL,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_hsn_code_firm UNIQUE (firm_id, code, effective_from)
);

-- ============================================================
-- C. GST Party Profiles (Section 70-D)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.gst_party_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL DEFAULT public.my_firm_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  party_id TEXT NOT NULL,                            -- references people.id
  gstin TEXT,
  registration_type TEXT NOT NULL DEFAULT 'unregistered'
    CHECK (registration_type IN ('regular', 'composition', 'unregistered', 'sez', 'sez_developer', 'uin_holder', 'tds_deductor', 'embassy')),
  state_code TEXT,
  place_of_supply TEXT,
  billing_address JSONB NOT NULL DEFAULT '{}'::jsonb,
  shipping_address JSONB NOT NULL DEFAULT '{}'::jsonb,
  reverse_charge_applicable BOOLEAN NOT NULL DEFAULT false,
  tds_applicable BOOLEAN NOT NULL DEFAULT false,
  tcs_applicable BOOLEAN NOT NULL DEFAULT false,
  pan TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_gst_party_firm UNIQUE (firm_id, party_id)
);

-- ============================================================
-- D. GST Invoice Snapshots (Section 70-E)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.gst_invoice_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL DEFAULT public.my_firm_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  invoice_id TEXT NOT NULL,                          -- references invoices.id
  snapshot_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  supply_type TEXT NOT NULL DEFAULT 'intra_state'
    CHECK (supply_type IN ('intra_state', 'inter_state', 'sez', 'export', 'deemed_export')),
  place_of_supply TEXT NOT NULL,
  taxable_value_paise BIGINT NOT NULL DEFAULT 0,
  cgst_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  cgst_amount_paise BIGINT NOT NULL DEFAULT 0,
  sgst_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  sgst_amount_paise BIGINT NOT NULL DEFAULT 0,
  igst_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  igst_amount_paise BIGINT NOT NULL DEFAULT 0,
  cess_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  cess_amount_paise BIGINT NOT NULL DEFAULT 0,
  round_off_paise BIGINT NOT NULL DEFAULT 0,
  total_invoice_paise BIGINT NOT NULL DEFAULT 0,
  hsn_code TEXT,
  rule_version_id UUID REFERENCES public.compliance_rule_versions(id) ON DELETE SET NULL,
  reverse_charge BOOLEAN NOT NULL DEFAULT false,
  party_gstin TEXT,
  party_state_code TEXT,
  line_items JSONB NOT NULL DEFAULT '[]'::jsonb,     -- detailed line breakup
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- E. GST Return Outbox (Section 70-F/G)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.gst_return_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL DEFAULT public.my_firm_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  return_type TEXT NOT NULL
    CHECK (return_type IN ('gstr1', 'gstr3b', 'gstr9', 'gstr2a_recon', 'gstr2b_recon')),
  period_month INT NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year INT NOT NULL CHECK (period_year >= 2017),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'prepared', 'reviewed', 'verified', 'exported', 'filed')),
  summary_data JSONB NOT NULL DEFAULT '{}'::jsonb,   -- aggregated tax summaries
  line_items JSONB NOT NULL DEFAULT '[]'::jsonb,     -- individual transaction entries
  exceptions JSONB NOT NULL DEFAULT '[]'::jsonb,     -- validation issues
  export_payload JSONB,                               -- final export JSON/XML
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  verified_by UUID,
  verified_at TIMESTAMPTZ,
  exported_at TIMESTAMPTZ,
  filed_at TIMESTAMPTZ,
  filing_reference TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_gst_return_period UNIQUE (firm_id, return_type, period_year, period_month)
);

-- ============================================================
-- F. E-Way Bill Records (Section 70-K)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.eway_bill_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL DEFAULT public.my_firm_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  linked_document_type TEXT NOT NULL,                 -- 'delivery_challan', 'invoice', 'stock_transfer'
  linked_document_id TEXT NOT NULL,
  eway_bill_number TEXT,
  generated_at TIMESTAMPTZ,
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  from_place TEXT,
  from_state_code TEXT,
  to_place TEXT,
  to_state_code TEXT,
  transporter_id TEXT,
  transporter_name TEXT,
  vehicle_number TEXT,
  transport_mode TEXT DEFAULT 'road'
    CHECK (transport_mode IN ('road', 'rail', 'air', 'ship')),
  distance_km INT,
  total_value_paise BIGINT NOT NULL DEFAULT 0,
  total_weight_grams NUMERIC(12,3),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'generated', 'cancelled', 'expired', 'extended')),
  api_response JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- G. E-Invoice Records (Section 70-L)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.einvoice_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL DEFAULT public.my_firm_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  invoice_id TEXT NOT NULL,
  irn TEXT,                                          -- Invoice Reference Number
  ack_number TEXT,
  ack_date TIMESTAMPTZ,
  signed_qr_code TEXT,
  signed_invoice_data JSONB,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'generated', 'cancelled', 'error')),
  error_details JSONB,
  api_response JSONB,
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- H. BIS / Hallmark Registry (Section 70-N)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.bis_hallmark_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL DEFAULT public.my_firm_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  huid TEXT NOT NULL,                                -- 6-char alphanumeric HUID
  article_type TEXT NOT NULL,                        -- 'ring', 'chain', 'bangle', 'pendant', etc.
  purity_karat NUMERIC(5,2) NOT NULL,
  purity_fineness NUMERIC(8,5),
  assay_centre_name TEXT,
  assay_centre_code TEXT,
  assaying_date DATE,
  hallmark_date DATE,
  linked_stock_item_id TEXT,                         -- references inventory.id
  linked_job_card_id TEXT,                           -- references job_cards.id
  bis_registration_number TEXT,
  weight_grams NUMERIC(12,3),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'sold', 'returned', 'melted', 'transferred')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_huid_firm UNIQUE (firm_id, huid)    -- no duplicate HUID per firm
);

-- ============================================================
-- I. Compliance Exceptions Dashboard (Section 70-S)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.compliance_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL DEFAULT public.my_firm_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  exception_type TEXT NOT NULL,                      -- 'missing_gstin', 'invalid_hsn', 'missing_huid', 'unregistered_jobwork', 'expired_license', etc.
  severity TEXT NOT NULL DEFAULT 'warning'
    CHECK (severity IN ('info', 'warning', 'critical')),
  entity_type TEXT NOT NULL,                         -- 'party', 'invoice', 'stock_item', 'job_card'
  entity_id TEXT NOT NULL,
  description TEXT NOT NULL,
  resolution_status TEXT NOT NULL DEFAULT 'open'
    CHECK (resolution_status IN ('open', 'acknowledged', 'resolved', 'ignored')),
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  auto_detected BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Indexes for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_compliance_rules_firm ON public.compliance_rules(firm_id);
CREATE INDEX IF NOT EXISTS idx_compliance_rule_versions_rule ON public.compliance_rule_versions(rule_id);
CREATE INDEX IF NOT EXISTS idx_compliance_rule_versions_status ON public.compliance_rule_versions(status, effective_from);
CREATE INDEX IF NOT EXISTS idx_hsn_sac_firm ON public.hsn_sac_codes(firm_id, code);
CREATE INDEX IF NOT EXISTS idx_gst_party_profiles_firm ON public.gst_party_profiles(firm_id, party_id);
CREATE INDEX IF NOT EXISTS idx_gst_invoice_snapshots_firm ON public.gst_invoice_snapshots(firm_id, invoice_id);
CREATE INDEX IF NOT EXISTS idx_gst_return_outbox_firm_period ON public.gst_return_outbox(firm_id, return_type, period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_eway_bill_firm ON public.eway_bill_records(firm_id, linked_document_id);
CREATE INDEX IF NOT EXISTS idx_einvoice_firm ON public.einvoice_records(firm_id, invoice_id);
CREATE INDEX IF NOT EXISTS idx_bis_hallmark_firm ON public.bis_hallmark_registry(firm_id, huid);
CREATE INDEX IF NOT EXISTS idx_compliance_exceptions_firm ON public.compliance_exceptions(firm_id, exception_type, resolution_status);

-- ============================================================
-- RLS Policies — firm-scoped isolation
-- ============================================================
ALTER TABLE public.compliance_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_rule_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hsn_sac_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gst_party_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gst_invoice_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gst_return_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eway_bill_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.einvoice_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bis_hallmark_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_exceptions ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read/write their own firm's data
CREATE POLICY "compliance_rules_firm_isolation" ON public.compliance_rules
  FOR ALL USING (firm_id = public.my_firm_id()) WITH CHECK (firm_id = public.my_firm_id());
CREATE POLICY "compliance_rule_versions_firm_isolation" ON public.compliance_rule_versions
  FOR ALL USING (firm_id = public.my_firm_id()) WITH CHECK (firm_id = public.my_firm_id());
CREATE POLICY "hsn_sac_codes_firm_isolation" ON public.hsn_sac_codes
  FOR ALL USING (firm_id = public.my_firm_id()) WITH CHECK (firm_id = public.my_firm_id());
CREATE POLICY "gst_party_profiles_firm_isolation" ON public.gst_party_profiles
  FOR ALL USING (firm_id = public.my_firm_id()) WITH CHECK (firm_id = public.my_firm_id());
CREATE POLICY "gst_invoice_snapshots_firm_isolation" ON public.gst_invoice_snapshots
  FOR ALL USING (firm_id = public.my_firm_id()) WITH CHECK (firm_id = public.my_firm_id());
CREATE POLICY "gst_return_outbox_firm_isolation" ON public.gst_return_outbox
  FOR ALL USING (firm_id = public.my_firm_id()) WITH CHECK (firm_id = public.my_firm_id());
CREATE POLICY "eway_bill_records_firm_isolation" ON public.eway_bill_records
  FOR ALL USING (firm_id = public.my_firm_id()) WITH CHECK (firm_id = public.my_firm_id());
CREATE POLICY "einvoice_records_firm_isolation" ON public.einvoice_records
  FOR ALL USING (firm_id = public.my_firm_id()) WITH CHECK (firm_id = public.my_firm_id());
CREATE POLICY "bis_hallmark_registry_firm_isolation" ON public.bis_hallmark_registry
  FOR ALL USING (firm_id = public.my_firm_id()) WITH CHECK (firm_id = public.my_firm_id());
CREATE POLICY "compliance_exceptions_firm_isolation" ON public.compliance_exceptions
  FOR ALL USING (firm_id = public.my_firm_id()) WITH CHECK (firm_id = public.my_firm_id());
