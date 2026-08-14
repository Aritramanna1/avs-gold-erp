-- =====================================================================
-- Migration: 20260814232000_canonical_schema_alignments.sql
-- Description: Canonical Table Migrations for Party 360, Migration Wizard, Rate Book, Item Masters & Backup/Restore
-- Authoritative Master Specs: PARTY_360_MASTER.md, OPENING_BALANCE_AND_MIGRATION_MASTER.md,
--                              ITEM_AND_MATERIAL_MASTER.md, RATE_BOOK_MASTER.md, BACKUP_RESTORE_MASTER.md
-- Milestone: M1 (Backend Security Hardening & Canonical Schema Alignments)
-- =====================================================================

-- 1. Party Role Profiles (PARTY_360_MASTER.md §2-§4)
CREATE TABLE IF NOT EXISTS public.party_role_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  party_id text NOT NULL,
  role_type text NOT NULL, -- 'customer', 'supplier', 'karigar', 'outside_karigar', 'refinery', 'hallmark_vendor', 'employee', 'agent', 'service_provider', 'other'
  credit_limit_paise bigint NOT NULL DEFAULT 0,
  metal_limit_mg bigint NOT NULL DEFAULT 0,
  credit_days integer NOT NULL DEFAULT 0,
  stop_billing_date date,
  allowed_wastage_pct numeric(5,2) DEFAULT 0.00,
  making_rate_paise bigint DEFAULT 0,
  making_charge_type text DEFAULT 'per_gram_gross',
  is_active boolean NOT NULL DEFAULT true,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.party_role_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS party_role_profiles_tenant_select ON public.party_role_profiles;
CREATE POLICY party_role_profiles_tenant_select ON public.party_role_profiles
  FOR SELECT TO authenticated
  USING (public.is_saas_admin() OR firm_id = public.my_firm_id() OR (firm_id IS NULL AND public.my_firm_id() IS NULL));
DROP POLICY IF EXISTS party_role_profiles_tenant_write ON public.party_role_profiles;
CREATE POLICY party_role_profiles_tenant_write ON public.party_role_profiles
  FOR ALL TO authenticated
  USING (public.is_saas_admin() OR (firm_id = public.my_firm_id() AND NOT public.is_customer_role()))
  WITH CHECK (public.is_saas_admin() OR (firm_id = public.my_firm_id() AND NOT public.is_customer_role()));
CREATE TRIGGER trg_party_role_profiles_uat BEFORE UPDATE ON public.party_role_profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Party Multi-Bank Account Registry (PARTY_360_MASTER.md §3.4)
CREATE TABLE IF NOT EXISTS public.party_bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  party_id text NOT NULL,
  bank_name text NOT NULL,
  account_holder_name text NOT NULL,
  account_number text NOT NULL,
  account_type text NOT NULL DEFAULT 'current', -- 'current', 'savings', 'cash_credit'
  ifsc_code text NOT NULL,
  branch_name text,
  upi_id text,
  is_primary boolean NOT NULL DEFAULT false,
  is_verified boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.party_bank_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS party_bank_accounts_tenant_select ON public.party_bank_accounts;
CREATE POLICY party_bank_accounts_tenant_select ON public.party_bank_accounts
  FOR SELECT TO authenticated
  USING (public.is_saas_admin() OR firm_id = public.my_firm_id() OR (firm_id IS NULL AND public.my_firm_id() IS NULL));
DROP POLICY IF EXISTS party_bank_accounts_tenant_write ON public.party_bank_accounts;
CREATE POLICY party_bank_accounts_tenant_write ON public.party_bank_accounts
  FOR ALL TO authenticated
  USING (public.is_saas_admin() OR (firm_id = public.my_firm_id() AND NOT public.is_customer_role()))
  WITH CHECK (public.is_saas_admin() OR (firm_id = public.my_firm_id() AND NOT public.is_customer_role()));
CREATE TRIGGER trg_party_bank_accounts_uat BEFORE UPDATE ON public.party_bank_accounts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Party Multi-Dimensional Opening Balances (OPENING_BALANCE_AND_MIGRATION_MASTER.md §2)
CREATE TABLE IF NOT EXISTS public.party_opening_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  party_id text NOT NULL,
  migration_batch_id text,
  as_of_date date NOT NULL,
  cash_debit_paise bigint NOT NULL DEFAULT 0,
  cash_credit_paise bigint NOT NULL DEFAULT 0,
  fine_gold_debit_mg bigint NOT NULL DEFAULT 0,
  fine_gold_credit_mg bigint NOT NULL DEFAULT 0,
  silver_debit_mg bigint NOT NULL DEFAULT 0,
  silver_credit_mg bigint NOT NULL DEFAULT 0,
  diamond_carats numeric(10,3) NOT NULL DEFAULT 0,
  diamond_pieces integer NOT NULL DEFAULT 0,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.party_opening_balances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS party_opening_balances_tenant_select ON public.party_opening_balances;
CREATE POLICY party_opening_balances_tenant_select ON public.party_opening_balances
  FOR SELECT TO authenticated
  USING (public.is_saas_admin() OR firm_id = public.my_firm_id() OR (firm_id IS NULL AND public.my_firm_id() IS NULL));
DROP POLICY IF EXISTS party_opening_balances_tenant_write ON public.party_opening_balances;
CREATE POLICY party_opening_balances_tenant_write ON public.party_opening_balances
  FOR ALL TO authenticated
  USING (public.is_saas_admin() OR (firm_id = public.my_firm_id() AND NOT public.is_customer_role()))
  WITH CHECK (public.is_saas_admin() OR (firm_id = public.my_firm_id() AND NOT public.is_customer_role()));
CREATE TRIGGER trg_party_opening_balances_uat BEFORE UPDATE ON public.party_opening_balances FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Immutable Migration Batches (OPENING_BALANCE_AND_MIGRATION_MASTER.md §3-§5)
CREATE TABLE IF NOT EXISTS public.migration_batches (
  id text PRIMARY KEY,
  firm_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  batch_number text NOT NULL,
  as_of_date text NOT NULL,
  status text NOT NULL DEFAULT 'DRAFT', -- 'DRAFT', 'SIMULATED', 'FROZEN_LIVE', 'ROLLED_BACK'
  frozen_at timestamptz,
  frozen_by text,
  checksum_sha256 text,
  dry_run_simulation jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.migration_batches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS migration_batches_tenant_select ON public.migration_batches;
CREATE POLICY migration_batches_tenant_select ON public.migration_batches
  FOR SELECT TO authenticated
  USING (public.is_saas_admin() OR firm_id = public.my_firm_id() OR (firm_id IS NULL AND public.my_firm_id() IS NULL));
DROP POLICY IF EXISTS migration_batches_tenant_write ON public.migration_batches;
CREATE POLICY migration_batches_tenant_write ON public.migration_batches
  FOR ALL TO authenticated
  USING (public.is_saas_admin() OR (firm_id = public.my_firm_id() AND NOT public.is_customer_role()))
  WITH CHECK (public.is_saas_admin() OR (firm_id = public.my_firm_id() AND NOT public.is_customer_role()));
CREATE TRIGGER trg_migration_batches_uat BEFORE UPDATE ON public.migration_batches FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. Versioned Rate Book History & Daily Bhav (RATE_BOOK_MASTER.md §2)
CREATE TABLE IF NOT EXISTS public.rate_book_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id text,
  metal_type text NOT NULL DEFAULT 'GOLD', -- 'GOLD', 'SILVER', 'PLATINUM', 'PALLADIUM'
  purity_id text,
  purity_label text,
  touch_pct numeric(5,2) NOT NULL DEFAULT 91.60,
  sell_rate_per_gram_paise bigint NOT NULL DEFAULT 0,
  buy_rate_per_gram_paise bigint NOT NULL DEFAULT 0,
  reference_rate_paise bigint,
  day_high_rate_paise bigint,
  day_low_rate_paise bigint,
  source_type text NOT NULL DEFAULT 'MANUAL_ENTRY', -- 'MANUAL_ENTRY', 'LIVE_MCX_FEED', 'BULK_BOOKING_CONTRACT'
  effective_from timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'SUPERSEDED', 'DRAFT'
  entered_by_user_id uuid,
  approved_by_user_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.rate_book_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rate_book_history_tenant_select ON public.rate_book_history;
CREATE POLICY rate_book_history_tenant_select ON public.rate_book_history
  FOR SELECT TO authenticated
  USING (public.is_saas_admin() OR firm_id = public.my_firm_id() OR (firm_id IS NULL AND public.my_firm_id() IS NULL));
DROP POLICY IF EXISTS rate_book_history_tenant_write ON public.rate_book_history;
CREATE POLICY rate_book_history_tenant_write ON public.rate_book_history
  FOR ALL TO authenticated
  USING (public.is_saas_admin() OR (firm_id = public.my_firm_id() AND NOT public.is_customer_role()))
  WITH CHECK (public.is_saas_admin() OR (firm_id = public.my_firm_id() AND NOT public.is_customer_role()));

-- 6. Canonical Item Masters (ITEM_AND_MATERIAL_MASTER.md §2)
CREATE TABLE IF NOT EXISTS public.item_masters (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  firm_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  item_code text NOT NULL,
  item_name text NOT NULL,
  item_group text,
  category text NOT NULL,
  metal_type text NOT NULL DEFAULT 'gold',
  purity_stamp text NOT NULL DEFAULT '22K (916)',
  default_touch_pct numeric(5,2) NOT NULL DEFAULT 91.60,
  fine_calculation_mode text NOT NULL DEFAULT 'touch_only', -- 'touch_only', 'touch_plus_wastage'
  labour_basis text NOT NULL DEFAULT 'per_gram_gross', -- 'per_gram_gross', 'per_gram_net', 'fixed_piece', 'percent_metal'
  default_making_rate_paise bigint NOT NULL DEFAULT 0,
  min_making_charge_paise bigint NOT NULL DEFAULT 0,
  allowed_wastage_pct numeric(5,2) NOT NULL DEFAULT 0.00,
  stock_method text NOT NULL DEFAULT 'tagged_only', -- 'tagged_only', 'loose_stock', 'hybrid'
  tag_weight_deduction_mg bigint NOT NULL DEFAULT 0,
  huid_applicable boolean NOT NULL DEFAULT true,
  hsn_code text NOT NULL DEFAULT '7113',
  is_active boolean NOT NULL DEFAULT true,
  design_code text,
  collection_name text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.item_masters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS item_masters_tenant_select ON public.item_masters;
CREATE POLICY item_masters_tenant_select ON public.item_masters
  FOR SELECT TO authenticated
  USING (public.is_saas_admin() OR firm_id = public.my_firm_id() OR (firm_id IS NULL AND public.my_firm_id() IS NULL));
DROP POLICY IF EXISTS item_masters_tenant_write ON public.item_masters;
CREATE POLICY item_masters_tenant_write ON public.item_masters
  FOR ALL TO authenticated
  USING (public.is_saas_admin() OR (firm_id = public.my_firm_id() AND NOT public.is_customer_role()))
  WITH CHECK (public.is_saas_admin() OR (firm_id = public.my_firm_id() AND NOT public.is_customer_role()));
CREATE TRIGGER trg_item_masters_uat BEFORE UPDATE ON public.item_masters FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 7. Tenant Encrypted Backups (BACKUP_RESTORE_MASTER.md §2)
CREATE TABLE IF NOT EXISTS public.tenant_backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  backup_name text NOT NULL,
  archive_version text NOT NULL DEFAULT '3.1.0',
  schema_version text NOT NULL DEFAULT '20260814_01',
  encryption_algorithm text NOT NULL DEFAULT 'AES-GCM-256',
  sha256_checksum text NOT NULL,
  size_bytes bigint NOT NULL DEFAULT 0,
  storage_path text,
  download_url text,
  download_url_expires_at timestamptz,
  included_modules jsonb NOT NULL DEFAULT '[]'::jsonb,
  record_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'COMPLETED', -- 'PENDING', 'GENERATING', 'COMPLETED', 'FAILED'
  created_by_user_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tenant_backups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_backups_tenant_select ON public.tenant_backups;
CREATE POLICY tenant_backups_tenant_select ON public.tenant_backups
  FOR SELECT TO authenticated
  USING (public.is_saas_admin() OR firm_id = public.my_firm_id() OR (firm_id IS NULL AND public.my_firm_id() IS NULL));
DROP POLICY IF EXISTS tenant_backups_tenant_write ON public.tenant_backups;
CREATE POLICY tenant_backups_tenant_write ON public.tenant_backups
  FOR ALL TO authenticated
  USING (public.is_saas_admin() OR (firm_id = public.my_firm_id() AND NOT public.is_customer_role()))
  WITH CHECK (public.is_saas_admin() OR (firm_id = public.my_firm_id() AND NOT public.is_customer_role()));

-- 8. Tenant Restore Audit Log (BACKUP_RESTORE_MASTER.md §3)
CREATE TABLE IF NOT EXISTS public.tenant_restore_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  backup_id uuid REFERENCES public.tenant_backups(id) ON DELETE SET NULL,
  archive_checksum text NOT NULL,
  pre_restore_snapshot_id text,
  status text NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'VALIDATING', 'DRY_RUN', 'RESTORING', 'COMPLETED', 'FAILED', 'ROLLED_BACK'
  current_phase integer NOT NULL DEFAULT 1, -- Phases 1 through 7
  phase_results jsonb NOT NULL DEFAULT '{}'::jsonb,
  diff_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  dual_ledger_reconciliation jsonb NOT NULL DEFAULT '{}'::jsonb,
  initiated_by_user_id uuid,
  initiated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
ALTER TABLE public.tenant_restore_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_restore_audit_tenant_select ON public.tenant_restore_audit;
CREATE POLICY tenant_restore_audit_tenant_select ON public.tenant_restore_audit
  FOR SELECT TO authenticated
  USING (public.is_saas_admin() OR firm_id = public.my_firm_id() OR (firm_id IS NULL AND public.my_firm_id() IS NULL));
DROP POLICY IF EXISTS tenant_restore_audit_tenant_write ON public.tenant_restore_audit;
CREATE POLICY tenant_restore_audit_tenant_write ON public.tenant_restore_audit
  FOR ALL TO authenticated
  USING (public.is_saas_admin() OR (firm_id = public.my_firm_id() AND NOT public.is_customer_role()))
  WITH CHECK (public.is_saas_admin() OR (firm_id = public.my_firm_id() AND NOT public.is_customer_role()));
