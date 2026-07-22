# AVS ERP Database Structure Backup


> Schema-only backup generated from the repository SQL master and migrations on 2026-07-23. No row data is included. The live Supabase schema was not modified during this backup. auth.users and storage.* are managed by Supabase and are not defined in this repository schema.


## Classification

- Workshop-relevant: operational gold, people, organization, billing, document, audit, and communication tables.
- Legacy/enterprise-candidate: production planning, manufacturing, CRM, catalog, stone/hallmark, and outside-work tables.
- Supabase-managed: auth.users, storage.objects, and related managed schemas.


## Table inventory (69 repository-defined tables)


### app_settings

- Classification: Workshop-relevant
- Purpose: Repository-defined application table; purpose should be confirmed against current code usage.
- Source: 20260619223432_72c8476e-c3c5-4ed8-9475-058ce15df276.sql

SQL definition:
CREATE TABLE app_settings (
id text PRIMARY KEY,
  firm_id uuid,
  scope text NOT NULL DEFAULT 'firm',
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

### approval_requests

- Classification: Workshop-relevant
- Purpose: Repository-defined application table; purpose should be confirmed against current code usage.
- Source: AVS_GOLD_ERP_HYBRID_MASTER.sql

SQL definition:
CREATE TABLE approval_requests (
id text PRIMARY KEY,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

### attachments

- Classification: Workshop-relevant
- Purpose: Repository-defined application table; purpose should be confirmed against current code usage.
- Source: 20260620171200_create_attachments_table.sql

SQL definition:
CREATE TABLE attachments (
id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  linked_table TEXT NOT NULL,
  linked_id TEXT NOT NULL,
  file_name TEXT,
  storage_path TEXT,
  mime_type TEXT,
  size_bytes INT,
  data JSONB NOT NULL DEFAULT '{}',
  firm_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

### attendance

- Classification: Review
- Purpose: Repository-defined application table; purpose should be confirmed against current code usage.
- Source: 20260619223432_72c8476e-c3c5-4ed8-9475-058ce15df276.sql

SQL definition:
CREATE TABLE attendance (
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

### branch_settings

- Classification: Review
- Purpose: Repository-defined application table; purpose should be confirmed against current code usage.
- Source: AVS_GOLD_ERP_HYBRID_MASTER.sql

SQL definition:
CREATE TABLE branch_settings (
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

### branches

- Classification: Workshop-relevant
- Purpose: Organization branches and branch settings.
- Source: 20260627120000_multi_branch_and_comm_providers.sql

SQL definition:
CREATE TABLE branches (
id            TEXT PRIMARY KEY,           -- e.g. "branch_retail_ich"
  name          TEXT NOT NULL,
  short_name    TEXT NOT NULL,
  branch_type   TEXT NOT NULL CHECK (branch_type IN ('retail', 'manufacturing')),
  city          TEXT NOT NULL,
  state         TEXT NOT NULL,
  gstin         TEXT,
  phone         TEXT,
  email         TEXT,
  address       TEXT,
  logo_url      TEXT,
  invoice_prefix TEXT NOT NULL DEFAULT '',
  barcode_prefix TEXT NOT NULL DEFAULT '',
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  settings      JSONB NOT NULL DEFAULT '{}',  -- per-branch settings blob
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

### catalog_designs

- Classification: Legacy/enterprise-candidate
- Purpose: Repository-defined application table; purpose should be confirmed against current code usage.
- Source: 20260619223432_72c8476e-c3c5-4ed8-9475-058ce15df276.sql

SQL definition:
CREATE TABLE catalog_designs (
id text PRIMARY KEY,
  firm_id uuid,
  design_no text,
  name text NOT NULL,
  category text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

### comm_events

- Classification: Workshop-relevant
- Purpose: Repository-defined application table; purpose should be confirmed against current code usage.
- Source: 20260627120000_multi_branch_and_comm_providers.sql

SQL definition:
CREATE TABLE comm_events (
id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id       TEXT NOT NULL DEFAULT 'branch_retail_ich',
  channel         TEXT NOT NULL,
  provider        TEXT NOT NULL,
  template        TEXT NOT NULL,
  recipient_name  TEXT NOT NULL,
  recipient_contact TEXT,      -- phone or email
  linked_type     TEXT,
  linked_id       TEXT,
  status          TEXT NOT NULL DEFAULT 'queued',
  message_id      TEXT,        -- Provider message ID if available
  error_message   TEXT,
  body_preview    TEXT,        -- First 200 chars of message
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

### comm_provider_settings

- Classification: Workshop-relevant
- Purpose: Repository-defined application table; purpose should be confirmed against current code usage.
- Source: 20260627120000_multi_branch_and_comm_providers.sql

SQL definition:
CREATE TABLE comm_provider_settings (
id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id       TEXT NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  channel         TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp', 'sms')),
  provider_type   TEXT NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  priority        INTEGER NOT NULL DEFAULT 0,
  -- Credentials stored as encrypted JSON (never plain text in application)
  settings        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

### communication_logs

- Classification: Workshop-relevant
- Purpose: Repository-defined application table; purpose should be confirmed against current code usage.
- Source: AVS_GOLD_ERP_HYBRID_MASTER.sql

SQL definition:
CREATE TABLE communication_logs (
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

### credit_notes

- Classification: Workshop-relevant
- Purpose: Repository-defined application table; purpose should be confirmed against current code usage.
- Source: 20260703040000_billing_documents.sql

SQL definition:
CREATE TABLE credit_notes (
id          TEXT PRIMARY KEY,
  branch_id   TEXT REFERENCES public.branches(id) ON DELETE SET NULL,
  invoice_id  TEXT,
  customer_id TEXT,
  status      TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'cancelled')),
  data        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

### crm_interactions

- Classification: Legacy/enterprise-candidate
- Purpose: Repository-defined application table; purpose should be confirmed against current code usage.
- Source: 20260628120000_crm_core.sql

SQL definition:
CREATE TABLE crm_interactions (
id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id           TEXT NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  person_id           TEXT NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  opportunity_id      UUID REFERENCES public.crm_leads_opportunities(id) ON DELETE SET NULL,
  type                TEXT NOT NULL CHECK (type IN ('note', 'call', 'meeting', 'whatsapp', 'email', 'sms', 'comment', 'system_event')),
  title               TEXT NOT NULL,
  body                TEXT,
  staff_email         TEXT,
  data                JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

### crm_leads_opportunities

- Classification: Legacy/enterprise-candidate
- Purpose: Repository-defined application table; purpose should be confirmed against current code usage.
- Source: 20260628120000_crm_core.sql

SQL definition:
CREATE TABLE crm_leads_opportunities (
id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id           TEXT NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  person_id           TEXT REFERENCES public.people(id) ON DELETE CASCADE, -- Link to customer/prospect
  lead_name           TEXT NOT NULL, -- e.g., "Rahul Sharma Wedding Order"
  stage               TEXT NOT NULL CHECK (stage IN ('lead', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost')),
  priority            TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  estimated_value_paise BIGINT NOT NULL DEFAULT 0,
  target_gold_mg      BIGINT NOT NULL DEFAULT 0,
  assigned_staff_email TEXT,
  follow_up_date      DATE,
  last_contacted_at   TIMESTAMPTZ,
  remarks             TEXT,
  data                JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

### crm_tasks_meetings

- Classification: Legacy/enterprise-candidate
- Purpose: Repository-defined application table; purpose should be confirmed against current code usage.
- Source: 20260628120000_crm_core.sql

SQL definition:
CREATE TABLE crm_tasks_meetings (
id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id           TEXT NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  person_id           TEXT REFERENCES public.people(id) ON DELETE CASCADE,
  opportunity_id      UUID REFERENCES public.crm_leads_opportunities(id) ON DELETE SET NULL,
  title               TEXT NOT NULL,
  type                TEXT NOT NULL CHECK (type IN ('task', 'meeting', 'follow_up')),
  status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'overdue', 'cancelled')),
  priority            TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  due_date            TIMESTAMPTZ NOT NULL,
  assigned_staff_email TEXT,
  description         TEXT,
  data                JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

### customer_ledger

- Classification: Workshop-relevant
- Purpose: Repository-defined application table; purpose should be confirmed against current code usage.
- Source: 20260619223432_72c8476e-c3c5-4ed8-9475-058ce15df276.sql

SQL definition:
CREATE TABLE customer_ledger (
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

### customer_settlements

- Classification: Legacy/enterprise-candidate
- Purpose: Repository-defined application table; purpose should be confirmed against current code usage.
- Source: 20260707000000_customer_settlements.sql

SQL definition:
CREATE TABLE customer_settlements (
id          TEXT PRIMARY KEY,
  branch_id   TEXT,
  order_id    TEXT,
  worker_id   TEXT,
  data        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

### daily_close

- Classification: Workshop-relevant
- Purpose: Repository-defined application table; purpose should be confirmed against current code usage.
- Source: 20260619223432_72c8476e-c3c5-4ed8-9475-058ce15df276.sql

SQL definition:
CREATE TABLE daily_close (
id text PRIMARY KEY,
  firm_id uuid,
  date date NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

### debit_notes

- Classification: Workshop-relevant
- Purpose: Repository-defined application table; purpose should be confirmed against current code usage.
- Source: 20260703040000_billing_documents.sql

SQL definition:
CREATE TABLE debit_notes (
id          TEXT PRIMARY KEY,
  branch_id   TEXT REFERENCES public.branches(id) ON DELETE SET NULL,
  invoice_id  TEXT,
  customer_id TEXT,
  status      TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'cancelled')),
  data        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

### delivery_challans

- Classification: Workshop-relevant
- Purpose: Repository-defined application table; purpose should be confirmed against current code usage.
- Source: 20260703040000_billing_documents.sql

SQL definition:
CREATE TABLE delivery_challans (
id          TEXT PRIMARY KEY,
  branch_id   TEXT REFERENCES public.branches(id) ON DELETE SET NULL,
  customer_id TEXT,
  status      TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'returned', 'converted_to_invoice', 'cancelled')),
  data        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

### document_sequences

- Classification: Workshop-relevant
- Purpose: Atomic business document numbering.
- Source: 20260625130000_setup_atomic_sequence_numbering.sql

SQL definition:
CREATE TABLE document_sequences (
type text NOT NULL,
    prefix text NOT NULL,
    last_value integer NOT NULL DEFAULT 0,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT document_sequences_pkey PRIMARY KEY (type, prefix)
);

### document_shares

- Classification: Workshop-relevant
- Purpose: Repository-defined application table; purpose should be confirmed against current code usage.
- Source: 20260701000000_document_shares.sql

SQL definition:
CREATE TABLE document_shares (
id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type    TEXT NOT NULL,
  document_id      TEXT NOT NULL,
  firm_snapshot    JSONB NOT NULL DEFAULT '{}',
  document_snapshot JSONB NOT NULL DEFAULT '{}',
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  branch_id   TEXT
);

### dropdown_masters

- Classification: Workshop-relevant
- Purpose: Repository-defined application table; purpose should be confirmed against current code usage.
- Source: 20260619223432_72c8476e-c3c5-4ed8-9475-058ce15df276.sql

SQL definition:
CREATE TABLE dropdown_masters (
id text PRIMARY KEY,
  firm_id uuid,
  master_key text NOT NULL,
  value text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

### erp_schema_meta

- Classification: Review
- Purpose: Repository-defined application table; purpose should be confirmed against current code usage.
- Source: AVS_GOLD_ERP_HYBRID_MASTER.sql

SQL definition:
CREATE TABLE erp_schema_meta (
id text PRIMARY KEY,
  schema_version integer NOT NULL,
  product text NOT NULL,
  deployment_model text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

### erp_setup_guard

- Classification: Review
- Purpose: Repository-defined application table; purpose should be confirmed against current code usage.
- Source: AVS_GOLD_ERP_HYBRID_MASTER.sql

SQL definition:
CREATE TABLE erp_setup_guard (
id text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

### estimates

- Classification: Workshop-relevant
- Purpose: Repository-defined application table; purpose should be confirmed against current code usage.
- Source: 20260703040000_billing_documents.sql

SQL definition:
CREATE TABLE estimates (
id          TEXT PRIMARY KEY,
  branch_id   TEXT REFERENCES public.branches(id) ON DELETE SET NULL,
  customer_id TEXT,
  status      TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'converted', 'expired', 'cancelled')),
  data        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

### file_attachments

- Classification: Workshop-relevant
- Purpose: Repository-defined application table; purpose should be confirmed against current code usage.
- Source: 20260621120000_create_file_attachments_table.sql

SQL definition:
CREATE TABLE file_attachments (
id TEXT PRIMARY KEY,
  storage_provider TEXT NOT NULL DEFAULT 'hostinger',
  file_path TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  original_file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  related_module TEXT NOT NULL, -- 'firm-logos', 'catalog', 'order-attachments', 'repair-photos', etc.
  related_table TEXT NOT NULL,
  related_record_id TEXT NOT NULL,
  branch_id TEXT,
  uploaded_by TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  notes TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

### financial_lock_periods

- Classification: Workshop-relevant
- Purpose: Repository-defined application table; purpose should be confirmed against current code usage.
- Source: 20260703000000_financial_lock_and_stock_verification.sql

SQL definition:
CREATE TABLE financial_lock_periods (
id          TEXT PRIMARY KEY,
  branch_id   TEXT NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  period      TEXT NOT NULL, -- "YYYY-MM"
  data        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (branch_id, period)
);

### gold_ledger

- Classification: Workshop-relevant
- Purpose: Fine-gold ledger and bucket movements.
- Source: 20260619223432_72c8476e-c3c5-4ed8-9475-058ce15df276.sql

SQL definition:
CREATE TABLE gold_ledger (
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

### gold_settlements

- Classification: Workshop-relevant
- Purpose: Repository-defined application table; purpose should be confirmed against current code usage.
- Source: 20260621110000_create_storage_policies_and_gold_settlements.sql

SQL definition:
CREATE TABLE gold_settlements (
id TEXT PRIMARY KEY,
  firm_id UUID,
  settlement_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  party_type TEXT NOT NULL, -- 'customer', 'worker', 'vendor', 'internal'
  party_id TEXT NOT NULL,
  branch_id TEXT,
  settlement_type TEXT NOT NULL, -- 'gold_received', 'gold_given', 'cash_received_against_gold', 'cash_paid_against_gold', 'wastage_adjustment', 'overloss_adjustment', 'final_settlement'
  purity SMALLINT NOT NULL DEFAULT 916,
  gross_mg BIGINT NOT NULL DEFAULT 0,
  net_mg BIGINT NOT NULL DEFAULT 0,
  wastage_mg BIGINT NOT NULL DEFAULT 0,
  rate_per_gram_paise BIGINT NOT NULL DEFAULT 0,
  amount_paise BIGINT NOT NULL DEFAULT 0,
  payment_mode TEXT,
  notes TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

### hallmark_batches

- Classification: Legacy/enterprise-candidate
- Purpose: Repository-defined application table; purpose should be confirmed against current code usage.
- Source: 20260703030000_hallmark_lifecycle.sql

SQL definition:
CREATE TABLE hallmark_batches (
id            TEXT PRIMARY KEY,
  branch_id     TEXT NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  batch_number  TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'partially_received', 'received', 'closed')),
  data          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (branch_id, batch_number)
);

### inventory

- Classification: Workshop-relevant
- Purpose: Repository-defined application table; purpose should be confirmed against current code usage.
- Source: 20260619223432_72c8476e-c3c5-4ed8-9475-058ce15df276.sql

SQL definition:
CREATE TABLE inventory (
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

### invoices

- Classification: Workshop-relevant
- Purpose: Billing invoices.
- Source: 20260619223432_72c8476e-c3c5-4ed8-9475-058ce15df276.sql

SQL definition:
CREATE TABLE invoices (
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

### job_cards

- Classification: Legacy/enterprise-candidate
- Purpose: Legacy manufacturing job cards.
- Source: 20260619223432_72c8476e-c3c5-4ed8-9475-058ce15df276.sql

SQL definition:
CREATE TABLE job_cards (
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

### job_process_steps

- Classification: Legacy/enterprise-candidate
- Purpose: Repository-defined application table; purpose should be confirmed against current code usage.
- Source: 20260619223432_72c8476e-c3c5-4ed8-9475-058ce15df276.sql

SQL definition:
CREATE TABLE job_process_steps (
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

### kyc_documents

- Classification: Review
- Purpose: Repository-defined application table; purpose should be confirmed against current code usage.
- Source: 20260619223432_72c8476e-c3c5-4ed8-9475-058ce15df276.sql

SQL definition:
CREATE TABLE kyc_documents (
id text PRIMARY KEY,
  person_id text NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  firm_id uuid,
  kind text NOT NULL,
  storage_path text,
  data_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

### licenses

- Classification: Workshop-relevant
- Purpose: Repository-defined application table; purpose should be confirmed against current code usage.
- Source: 20260722000000_create_licenses_table.sql

SQL definition:
CREATE TABLE licenses (
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id text UNIQUE NOT NULL,
  customer_name text NOT NULL,
  company_name text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  edition text NOT NULL,
  seats integer NOT NULL DEFAULT 1,
  expiry_date timestamptz,
  payload text NOT NULL,
  signature text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

### login_attempts

- Classification: Workshop-relevant
- Purpose: Repository-defined application table; purpose should be confirmed against current code usage.
- Source: 20260624130000_create_login_attempts_table.sql

SQL definition:
CREATE TABLE login_attempts (
id uuid primary key default gen_random_uuid(),
  email text,
  ip text,
  success boolean not null default false,
  created_at timestamptz not null default now()
);

### lot_batches

- Classification: Legacy/enterprise-candidate
- Purpose: Repository-defined application table; purpose should be confirmed against current code usage.
- Source: AVS_GOLD_ERP_HYBRID_MASTER.sql

SQL definition:
CREATE TABLE lot_batches (
id text PRIMARY KEY, data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);

### manufacturing_barcodes

- Classification: Legacy/enterprise-candidate
- Purpose: Repository-defined application table; purpose should be confirmed against current code usage.
- Source: AVS_GOLD_ERP_HYBRID_MASTER.sql

SQL definition:
CREATE TABLE manufacturing_barcodes (
id text PRIMARY KEY, data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);

### manufacturing_bills

- Classification: Legacy/enterprise-candidate
- Purpose: Repository-defined application table; purpose should be confirmed against current code usage.
- Source: 20260630_phase2_stabilization.sql

SQL definition:
CREATE TABLE manufacturing_bills (
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

### material_vault_movements

- Classification: Review
- Purpose: Repository-defined application table; purpose should be confirmed against current code usage.
- Source: AVS_GOLD_ERP_HYBRID_MASTER.sql

SQL definition:
CREATE TABLE material_vault_movements (
id text PRIMARY KEY, branch_id text, data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);

### melt_jobs

- Classification: Legacy/enterprise-candidate
- Purpose: Repository-defined application table; purpose should be confirmed against current code usage.
- Source: 20260628110000_melt_jobs.sql

SQL definition:
CREATE TABLE melt_jobs (
id uuid primary key default gen_random_uuid(),
  job_no text not null,
  branch_id uuid not null references public.branches(id) on delete cascade,
  date date not null default current_date,
  karigar_id uuid references public.people(id),
  karigar_name text,
  status text not null default 'open' check (status in ('open','processing','completed','cancelled')),
  -- Input weights (all in milligrams)
  scrap_input_gross_mg bigint not null default 0,
  scrap_input_purity integer not null default 0, -- per-mille
  dust_input_gross_mg bigint not null default 0,
  dust_input_purity integer not null default 0,
  other_input_gross_mg bigint not null default 0,
  other_input_purity integer not null default 0,
  total_input_fine_mg bigint not null default 0,
  -- Recovery weights
  fine_gold_recovered_mg bigint not null default 0,
  scrap_returned_mg bigint not null default 0,
  -- Calculations
  recovery_pct integer not null default 0, -- basis points e.g. 9850 = 98.50%
  loss_fine_mg bigint not null default 0,
  -- Refinery info
  refinery_name text,
  refinery_receipt_no text,
  refinery_sent_date date,
  refinery_received_date date,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

### module_states

- Classification: Workshop-relevant
- Purpose: Repository-defined application table; purpose should be confirmed against current code usage.
- Source: 20260628130000_feature_toggles.sql

SQL definition:
CREATE TABLE module_states (
id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id           TEXT NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  module_key          TEXT NOT NULL, -- e.g. 'billing', 'manufacturing', etc.
  enabled             BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(branch_id, module_key)
);

### order_issues

- Classification: Legacy/enterprise-candidate
- Purpose: Repository-defined application table; purpose should be confirmed against current code usage.
- Source: AVS_GOLD_ERP_HYBRID_MASTER.sql

SQL definition:
CREATE TABLE order_issues (
id text PRIMARY KEY, branch_id text, order_id text, worker_id text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);

### orders

- Classification: Review
- Purpose: Legacy enterprise order header records.
- Source: 20260619223432_72c8476e-c3c5-4ed8-9475-058ce15df276.sql

SQL definition:
CREATE TABLE orders (
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

### outside_work_labour_charges

- Classification: Legacy/enterprise-candidate
- Purpose: Repository-defined application table; purpose should be confirmed against current code usage.
- Source: 20260705010000_outside_work_labour_and_payments.sql

SQL definition:
CREATE TABLE outside_work_labour_charges (
id          TEXT PRIMARY KEY,
  branch_id   TEXT,
  order_id    TEXT,
  worker_id   TEXT,
  data        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

### outside_work_payments

- Classification: Legacy/enterprise-candidate
- Purpose: Repository-defined application table; purpose should be confirmed against current code usage.
- Source: 20260705010000_outside_work_labour_and_payments.sql

SQL definition:
CREATE TABLE outside_work_payments (
id          TEXT PRIMARY KEY,
  branch_id   TEXT,
  order_id    TEXT,
  worker_id   TEXT,
  data        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

### outside_work_transactions

- Classification: Legacy/enterprise-candidate
- Purpose: Repository-defined application table; purpose should be confirmed against current code usage.
- Source: 20260705000000_outside_work_transactions.sql

SQL definition:
CREATE TABLE outside_work_transactions (
id          TEXT PRIMARY KEY,
  branch_id   TEXT,
  order_id    TEXT,
  worker_id   TEXT,
  data        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

### payments

- Classification: Workshop-relevant
- Purpose: Invoice payments.
- Source: 20260619223432_72c8476e-c3c5-4ed8-9475-058ce15df276.sql

SQL definition:
CREATE TABLE payments (
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

### people

- Classification: Workshop-relevant
- Purpose: People, workers, jewellers, customers, and organization contacts.
- Source: 20260619223432_72c8476e-c3c5-4ed8-9475-058ce15df276.sql

SQL definition:
CREATE TABLE people (
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

### physical_stock_counts

- Classification: Workshop-relevant
- Purpose: Repository-defined application table; purpose should be confirmed against current code usage.
- Source: 20260703000000_financial_lock_and_stock_verification.sql

SQL definition:
CREATE TABLE physical_stock_counts (
id          TEXT PRIMARY KEY,
  branch_id   TEXT NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'cancelled')),
  data        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

### polishing_transactions

- Classification: Legacy/enterprise-candidate
- Purpose: Repository-defined application table; purpose should be confirmed against current code usage.
- Source: AVS_GOLD_ERP_HYBRID_MASTER.sql

SQL definition:
CREATE TABLE polishing_transactions (
id text PRIMARY KEY, branch_id text, data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);

### print_logs

- Classification: Workshop-relevant
- Purpose: Repository-defined application table; purpose should be confirmed against current code usage.
- Source: 20260619223432_72c8476e-c3c5-4ed8-9475-058ce15df276.sql

SQL definition:
CREATE TABLE print_logs (
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

### print_templates

- Classification: Workshop-relevant
- Purpose: Repository-defined application table; purpose should be confirmed against current code usage.
- Source: AVS_GOLD_ERP_HYBRID_MASTER.sql

SQL definition:
CREATE TABLE print_templates (
id text PRIMARY KEY, data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);

### rate_cut_records

- Classification: Legacy/enterprise-candidate
- Purpose: Repository-defined application table; purpose should be confirmed against current code usage.
- Source: 20260619223432_72c8476e-c3c5-4ed8-9475-058ce15df276.sql

SQL definition:
CREATE TABLE rate_cut_records (
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

### repairs

- Classification: Legacy/enterprise-candidate
- Purpose: Repository-defined application table; purpose should be confirmed against current code usage.
- Source: 20260619223432_72c8476e-c3c5-4ed8-9475-058ce15df276.sql

SQL definition:
CREATE TABLE repairs (
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

### salary_rules

- Classification: Workshop-relevant
- Purpose: Repository-defined application table; purpose should be confirmed against current code usage.
- Source: 20260619223432_72c8476e-c3c5-4ed8-9475-058ce15df276.sql

SQL definition:
CREATE TABLE salary_rules (
id text PRIMARY KEY,
  firm_id uuid,
  name text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

### saved_filters

- Classification: Review
- Purpose: Repository-defined application table; purpose should be confirmed against current code usage.
- Source: AVS_GOLD_ERP_HYBRID_MASTER.sql

SQL definition:
CREATE TABLE saved_filters (
id text PRIMARY KEY, data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);

### stock_lots

- Classification: Legacy/enterprise-candidate
- Purpose: Repository-defined application table; purpose should be confirmed against current code usage.
- Source: 20260703010000_lot_batch_management.sql

SQL definition:
CREATE TABLE stock_lots (
id              TEXT PRIMARY KEY,
  branch_id       TEXT NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  lot_number      TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  data            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (branch_id, lot_number)
);

### stock_movements

- Classification: Workshop-relevant
- Purpose: Repository-defined application table; purpose should be confirmed against current code usage.
- Source: 20260619223432_72c8476e-c3c5-4ed8-9475-058ce15df276.sql

SQL definition:
CREATE TABLE stock_movements (
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

### stock_stones

- Classification: Legacy/enterprise-candidate
- Purpose: Repository-defined application table; purpose should be confirmed against current code usage.
- Source: 20260703020000_stone_diamond_tracking.sql

SQL definition:
CREATE TABLE stock_stones (
id                  TEXT PRIMARY KEY,
  branch_id           TEXT NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  item_id             TEXT REFERENCES public.inventory(id) ON DELETE SET NULL,
  stone_type          TEXT NOT NULL,
  certificate_number  TEXT,
  data                JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

### stone_details

- Classification: Review
- Purpose: Repository-defined application table; purpose should be confirmed against current code usage.
- Source: AVS_GOLD_ERP_HYBRID_MASTER.sql

SQL definition:
CREATE TABLE stone_details (
id text PRIMARY KEY, branch_id text, data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);

### user_branch_permissions

- Classification: Workshop-relevant
- Purpose: Repository-defined application table; purpose should be confirmed against current code usage.
- Source: 20260627120000_multi_branch_and_comm_providers.sql

SQL definition:
CREATE TABLE user_branch_permissions (
id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  branch_id   TEXT NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN (
    'owner_ceo', 'branch_manager', 'billing_staff',
    'workshop_staff', 'accountant', 'readonly'
  )),
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, branch_id)
);

### user_roles

- Classification: Workshop-relevant
- Purpose: Supabase-authenticated user roles.
- Source: 20260619225425_ef6ac730-f04e-4e71-8858-a913522d62c2.sql

SQL definition:
CREATE TABLE user_roles (
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

### whatsapp_inbox

- Classification: Workshop-relevant
- Purpose: Repository-defined application table; purpose should be confirmed against current code usage.
- Source: 20260619223432_72c8476e-c3c5-4ed8-9475-058ce15df276.sql

SQL definition:
CREATE TABLE whatsapp_inbox (
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

### worker_returns

- Classification: Workshop-relevant
- Purpose: Worker gold/material return records.
- Source: 20260704000000_order_issues_and_worker_returns.sql

SQL definition:
CREATE TABLE worker_returns (
id          TEXT PRIMARY KEY,
  branch_id   TEXT,
  order_id    TEXT NOT NULL,
  worker_id   TEXT,
  data        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

### worker_settlements

- Classification: Workshop-relevant
- Purpose: Repository-defined application table; purpose should be confirmed against current code usage.
- Source: 20260619223432_72c8476e-c3c5-4ed8-9475-058ce15df276.sql

SQL definition:
CREATE TABLE worker_settlements (
id text PRIMARY KEY,
  firm_id uuid,
  worker_id text NOT NULL,
  period_from date,
  period_to date,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

### worker_transactions

- Classification: Workshop-relevant
- Purpose: Worker operational transactions and balances.
- Source: 20260619223432_72c8476e-c3c5-4ed8-9475-058ce15df276.sql

SQL definition:
CREATE TABLE worker_transactions (
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

### workshops

- Classification: Review
- Purpose: Repository-defined application table; purpose should be confirmed against current code usage.
- Source: AVS_GOLD_ERP_HYBRID_MASTER.sql

SQL definition:
CREATE TABLE workshops (
id text PRIMARY KEY,
  branch_id text REFERENCES public.branches(id) ON DELETE SET NULL,
  name text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

## Index definitions


CREATE INDEX IF NOT EXISTS document_shares_document_id_idx ON document_shares (document_id);

CREATE INDEX IF NOT EXISTS document_shares_expires_at_idx ON document_shares (expires_at);

CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance(date);

CREATE INDEX IF NOT EXISTS idx_attendance_worker ON public.attendance(worker_id);

CREATE INDEX IF NOT EXISTS idx_comm_events_branch ON public.comm_events(branch_id);

CREATE INDEX IF NOT EXISTS idx_comm_events_linked ON public.comm_events(linked_type, linked_id);

CREATE INDEX IF NOT EXISTS idx_comm_prov_branch_channel ON public.comm_provider_settings(branch_id, channel);

CREATE INDEX IF NOT EXISTS idx_communication_logs_linked ON public.communication_logs(linked_id);

CREATE INDEX IF NOT EXISTS idx_credit_notes_branch ON public.credit_notes(branch_id);

CREATE INDEX IF NOT EXISTS idx_credit_notes_invoice ON public.credit_notes(invoice_id);

CREATE INDEX IF NOT EXISTS idx_crm_interact_branch ON public.crm_interactions(branch_id);

CREATE INDEX IF NOT EXISTS idx_crm_interact_person ON public.crm_interactions(person_id);

CREATE INDEX IF NOT EXISTS idx_crm_leads_branch ON public.crm_leads_opportunities(branch_id);

CREATE INDEX IF NOT EXISTS idx_crm_leads_person ON public.crm_leads_opportunities(person_id);

CREATE INDEX IF NOT EXISTS idx_crm_leads_stage ON public.crm_leads_opportunities(stage);

CREATE INDEX IF NOT EXISTS idx_crm_tasks_branch ON public.crm_tasks_meetings(branch_id);

CREATE INDEX IF NOT EXISTS idx_crm_tasks_due ON public.crm_tasks_meetings(due_date);

CREATE INDEX IF NOT EXISTS idx_crm_tasks_person ON public.crm_tasks_meetings(person_id);

CREATE INDEX IF NOT EXISTS idx_customer_ledger_customer ON public.customer_ledger(customer_id);

CREATE INDEX IF NOT EXISTS idx_customer_settlements_order ON public.customer_settlements(order_id);

CREATE INDEX IF NOT EXISTS idx_debit_notes_branch ON public.debit_notes(branch_id);

CREATE INDEX IF NOT EXISTS idx_debit_notes_invoice ON public.debit_notes(invoice_id);

CREATE INDEX IF NOT EXISTS idx_delivery_challans_branch ON public.delivery_challans(branch_id);

CREATE INDEX IF NOT EXISTS idx_delivery_challans_customer ON public.delivery_challans(customer_id);

CREATE INDEX IF NOT EXISTS idx_delivery_challans_status ON public.delivery_challans(status);

CREATE INDEX IF NOT EXISTS idx_estimates_branch ON public.estimates(branch_id);

CREATE INDEX IF NOT EXISTS idx_estimates_customer ON public.estimates(customer_id);

CREATE INDEX IF NOT EXISTS idx_estimates_status ON public.estimates(status);

CREATE INDEX IF NOT EXISTS idx_financial_lock_periods_branch ON public.financial_lock_periods(branch_id);

CREATE INDEX IF NOT EXISTS idx_financial_lock_periods_period ON public.financial_lock_periods(period);

CREATE INDEX IF NOT EXISTS idx_financial_locks_branch ON public.financial_lock_periods(branch_id);

CREATE INDEX IF NOT EXISTS idx_gold_ledger_movement ON public.gold_ledger(movement);

CREATE INDEX IF NOT EXISTS idx_gold_ledger_ts ON public.gold_ledger(ts DESC);

CREATE INDEX IF NOT EXISTS idx_gold_settlements_branch ON public.gold_settlements(branch_id);

CREATE INDEX IF NOT EXISTS idx_gold_settlements_party ON public.gold_settlements(party_type, party_id);

CREATE INDEX IF NOT EXISTS idx_hallmark_batches_branch ON public.hallmark_batches(branch_id);

CREATE INDEX IF NOT EXISTS idx_hallmark_batches_status ON public.hallmark_batches(status);

CREATE INDEX IF NOT EXISTS idx_inventory_barcode ON public.inventory(barcode);

CREATE INDEX IF NOT EXISTS idx_inventory_status ON public.inventory(status);

CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON public.invoices(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_invoices_customer ON public.invoices(customer_id);

CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);

CREATE INDEX IF NOT EXISTS idx_job_cards_order ON public.job_cards(order_id);

CREATE INDEX IF NOT EXISTS idx_job_cards_status ON public.job_cards(status);

CREATE INDEX IF NOT EXISTS idx_melt_jobs_branch ON public.melt_jobs(branch_id);

CREATE INDEX IF NOT EXISTS idx_melt_jobs_date   ON public.melt_jobs(date DESC);

CREATE INDEX IF NOT EXISTS idx_melt_jobs_status ON public.melt_jobs(status);

CREATE INDEX IF NOT EXISTS idx_mfg_bills_bill_no    ON public.manufacturing_bills(bill_no);

CREATE INDEX IF NOT EXISTS idx_mfg_bills_branch     ON public.manufacturing_bills(branch_id);

CREATE INDEX IF NOT EXISTS idx_mfg_bills_branch    ON public.manufacturing_bills(branch_id);

CREATE INDEX IF NOT EXISTS idx_mfg_bills_created_at ON public.manufacturing_bills(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mfg_bills_customer   ON public.manufacturing_bills(customer_id);

CREATE INDEX IF NOT EXISTS idx_mfg_bills_customer  ON public.manufacturing_bills(customer_id);

CREATE INDEX IF NOT EXISTS idx_mfg_bills_job       ON public.manufacturing_bills(job_card_id);

CREATE INDEX IF NOT EXISTS idx_mfg_bills_job_card   ON public.manufacturing_bills(job_card_id);

CREATE INDEX IF NOT EXISTS idx_mfg_bills_order     ON public.manufacturing_bills(order_id);

CREATE INDEX IF NOT EXISTS idx_mfg_bills_status     ON public.manufacturing_bills(status);

CREATE INDEX IF NOT EXISTS idx_mfg_bills_status    ON public.manufacturing_bills(status);

CREATE INDEX IF NOT EXISTS idx_module_states_branch ON public.module_states(branch_id);

CREATE INDEX IF NOT EXISTS idx_orders_customer ON public.orders(customer_id);

CREATE INDEX IF NOT EXISTS idx_orders_karigar ON public.orders(karigar_id);

CREATE INDEX IF NOT EXISTS idx_orders_order_no ON public.orders(order_no);

CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);

CREATE INDEX IF NOT EXISTS idx_outside_work_labour_charges_order ON public.outside_work_labour_charges(order_id);

CREATE INDEX IF NOT EXISTS idx_outside_work_labour_charges_worker ON public.outside_work_labour_charges(worker_id);

CREATE INDEX IF NOT EXISTS idx_outside_work_payments_order ON public.outside_work_payments(order_id);

CREATE INDEX IF NOT EXISTS idx_outside_work_payments_worker ON public.outside_work_payments(worker_id);

CREATE INDEX IF NOT EXISTS idx_outside_work_transactions_order ON public.outside_work_transactions(order_id);

CREATE INDEX IF NOT EXISTS idx_outside_work_transactions_worker ON public.outside_work_transactions(worker_id);

CREATE INDEX IF NOT EXISTS idx_payments_invoice ON public.payments(invoice_id);

CREATE INDEX IF NOT EXISTS idx_people_full_name ON public.people(full_name);

CREATE INDEX IF NOT EXISTS idx_physical_stock_counts_branch ON public.physical_stock_counts(branch_id);

CREATE INDEX IF NOT EXISTS idx_physical_stock_counts_status ON public.physical_stock_counts(status);

CREATE INDEX IF NOT EXISTS idx_print_logs_linked ON public.print_logs(linked_id);

CREATE INDEX IF NOT EXISTS idx_repairs_customer ON public.repairs(customer_id);

CREATE INDEX IF NOT EXISTS idx_repairs_status ON public.repairs(status);

CREATE INDEX IF NOT EXISTS idx_stock_lots_branch ON public.stock_lots(branch_id);

CREATE INDEX IF NOT EXISTS idx_stock_lots_status ON public.stock_lots(status);

CREATE INDEX IF NOT EXISTS idx_stock_movements_item ON public.stock_movements(item_id);

CREATE INDEX IF NOT EXISTS idx_stock_stones_branch ON public.stock_stones(branch_id);

CREATE INDEX IF NOT EXISTS idx_stock_stones_certificate ON public.stock_stones(certificate_number);

CREATE INDEX IF NOT EXISTS idx_stock_stones_item ON public.stock_stones(item_id);

CREATE INDEX IF NOT EXISTS idx_user_branch_perms_user ON public.user_branch_permissions(user_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_inbox_sender_phone ON public.whatsapp_inbox(sender_phone);

CREATE INDEX IF NOT EXISTS idx_worker_returns_order ON public.worker_returns(order_id);

CREATE INDEX IF NOT EXISTS idx_worker_returns_worker ON public.worker_returns(worker_id);

CREATE INDEX IF NOT EXISTS idx_worker_settlements_worker ON public.worker_settlements(worker_id);

CREATE INDEX IF NOT EXISTS idx_worker_transactions_ts ON public.worker_transactions(ts DESC);

CREATE INDEX IF NOT EXISTS idx_worker_transactions_worker ON public.worker_transactions(worker_id);

EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_branch ON public.%I(branch_id)', tbl, tbl);

create index login_attempts_email_created_at_idx on public.login_attempts (email, created_at);

create index login_attempts_ip_created_at_idx on public.login_attempts (ip, created_at);

create index on public.melt_jobs(branch_id);

create index on public.melt_jobs(date);

create index on public.melt_jobs(karigar_id);

## Relationship and cleanup notes

- Foreign keys are preserved verbatim in each table definition above, including ON DELETE behavior.
- Primary keys are preserved in each table definition above.
- Several migrations use ALTER TABLE ... ADD COLUMN and dynamic branch-column additions; those migration statements remain the authoritative supplement to the table blocks.
- No table or column has been deleted as part of this backup step. Any cleanup must follow a separate reviewed migration after live usage and application references are confirmed.

## Additional legacy tables recorded by generated Supabase types

The following tables are present in the generated client schema/types but are not defined by the current repository migration set. They are recorded here before cleanup.

### `feature_flags`

Columns: `id text PRIMARY KEY`, `firm_id text`, `attendance boolean`, `barcode boolean`, `billing boolean`, `crm boolean`, `gold_ledger boolean`, `orders boolean`, `payroll boolean`, `repairs boolean`, `reports boolean`, `saas_panel boolean`, `stock boolean`, `whatsapp boolean`, `workshop boolean`, `updated_at timestamptz`, `updated_by text`.

### `gold_issue_register`

Columns: `id text PRIMARY KEY`, `firm_id text`, `issue_no text`, `worker_id text`, `particular text`, `gross_mg bigint`, `purity_ppt integer`, `fine_mg bigint`, `issued_at timestamptz`, `issued_by text`, `notes text`, `is_deleted boolean`, `deleted_at timestamptz`, `deleted_by text`, `data jsonb`, `created_at timestamptz`, `updated_at timestamptz`.

### `gold_receive_register`

Columns: `id text PRIMARY KEY`, `firm_id text`, `receive_no text`, `worker_id text`, `particular text`, `gross_mg bigint`, `purity_ppt integer`, `fine_mg bigint`, `received_at timestamptz`, `received_by text`, `notes text`, `is_deleted boolean`, `deleted_at timestamptz`, `deleted_by text`, `data jsonb`, `created_at timestamptz`, `updated_at timestamptz`.

### `invitations`

Columns: `id text PRIMARY KEY`, `email text`, `code text`, `role text`, `status text`, `branch_id text REFERENCES branches(id)`, `workshop_id text REFERENCES workshops(id)`, `invited_by text`, `expires_at timestamptz`, `created_at timestamptz`.

### `user_profiles`

Columns: `id text PRIMARY KEY`, `auth_id uuid`, `full_name text`, `phone text`, `avatar_url text`, `role text`, `status text`, `active boolean`, `is_super_owner boolean`, `department text`, `reporting_manager_id text`, `branch_id text REFERENCES branches(id)`, `firm_id text REFERENCES organizations(id)`, `workshop_id text REFERENCES workshops(id)`, `permissions jsonb`, `data jsonb`, `last_login timestamptz`, `created_at timestamptz`, `updated_at timestamptz`.

### `kyc_documents`

Columns: `id text PRIMARY KEY`, `person_id text REFERENCES people(id) ON DELETE CASCADE`, `firm_id uuid`, `kind text`, `storage_path text`, `data_url text`, `notes text`, `created_at timestamptz`, `updated_at timestamptz`. This is legacy identity-document storage and is a cleanup candidate for the Workshop Edition.

### `organizations`, `workshops`, `audit_logs`, `login_history`, `whatsapp_templates`, `worker_gold_balance`

These generated-type entries have no repository migration definition in the audited tree. Their live column definitions must be obtained from the connected Supabase schema before any destructive migration; they are not silently assumed or deleted.

