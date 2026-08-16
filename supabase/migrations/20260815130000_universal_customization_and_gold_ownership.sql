-- AVS / ORNEXA ERP — Universal Customization, Gold Ownership & Chart of Accounts Engine Migration
-- Master References: UNIVERSAL_CUSTOMIZATION_MASTER.md, CUSTOM_FIELDS_AND_FORMS_MASTER.md, UNIVERSAL_TRANSACTION_ENGINE.md, ACCOUNTING_AND_PERIOD_CONTROL.md

-- 1. Custom Business Entity Definitions
CREATE TABLE IF NOT EXISTS public.custom_entity_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL DEFAULT public.my_firm_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  entity_code TEXT NOT NULL,
  entity_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'counterparty',
  icon_name TEXT NOT NULL DEFAULT 'Building2',
  description TEXT,
  fields_schema JSONB NOT NULL DEFAULT '[]'::jsonb,
  search_fields JSONB NOT NULL DEFAULT '["name", "mobile"]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_custom_entity_code_firm UNIQUE (firm_id, entity_code)
);

-- 2. Custom Entity Records
CREATE TABLE IF NOT EXISTS public.custom_entity_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL DEFAULT public.my_firm_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  entity_definition_id UUID NOT NULL REFERENCES public.custom_entity_definitions(id) ON DELETE CASCADE,
  entity_code TEXT NOT NULL,
  record_code TEXT NOT NULL,
  primary_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_custom_entity_record_code UNIQUE (firm_id, entity_code, record_code)
);

-- 3. Custom Books & Registers Definitions
CREATE TABLE IF NOT EXISTS public.custom_book_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL DEFAULT public.my_firm_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  book_code TEXT NOT NULL,
  book_name TEXT NOT NULL,
  base_source TEXT NOT NULL,
  description TEXT,
  column_configs JSONB NOT NULL DEFAULT '[]'::jsonb,
  filter_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  grouping_rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_aggregates JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_system BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_custom_book_code_firm UNIQUE (firm_id, book_code)
);

-- 4. Gold Ownership Positions (Decoupled Ownership vs Physical Custody)
CREATE TABLE IF NOT EXISTS public.gold_ownership_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL DEFAULT public.my_firm_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id TEXT REFERENCES public.branches(id) ON DELETE SET NULL,
  party_id TEXT,
  party_name TEXT NOT NULL,
  position_type TEXT NOT NULL,
  gross_weight_mg BIGINT NOT NULL DEFAULT 0,
  touch_purity NUMERIC(6, 3) NOT NULL DEFAULT 91.600,
  fine_gold_mg BIGINT NOT NULL DEFAULT 0,
  physical_custodian_type TEXT NOT NULL DEFAULT 'vault',
  physical_vault_id TEXT,
  physical_lot_id TEXT,
  physical_is_utilized BOOLEAN NOT NULL DEFAULT false,
  liability_status TEXT NOT NULL DEFAULT 'active',
  allocated_order_id UUID,
  deposit_voucher_ref TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Real Inventory-Driven Metal Lots
CREATE TABLE IF NOT EXISTS public.metal_inventory_lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL DEFAULT public.my_firm_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id TEXT REFERENCES public.branches(id) ON DELETE SET NULL,
  lot_number TEXT NOT NULL,
  metal_type TEXT NOT NULL DEFAULT 'gold',
  purity_karat TEXT NOT NULL DEFAULT '24K',
  touch_purity NUMERIC(6, 3) NOT NULL DEFAULT 99.900,
  physical_form TEXT NOT NULL DEFAULT 'bar',
  vault_location TEXT NOT NULL DEFAULT 'Main Vault',
  gross_weight_mg BIGINT NOT NULL DEFAULT 0,
  fine_gold_mg BIGINT NOT NULL DEFAULT 0,
  available_gross_weight_mg BIGINT NOT NULL DEFAULT 0,
  available_fine_gold_mg BIGINT NOT NULL DEFAULT 0,
  ownership_party_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_lot_number_firm UNIQUE (firm_id, lot_number)
);

-- 6. Customization Version History (Draft, Preview, Publish, Rollback)
CREATE TABLE IF NOT EXISTS public.customization_version_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL DEFAULT public.my_firm_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  version_label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'published',
  snapshot_payload JSONB NOT NULL,
  published_by UUID DEFAULT auth.uid(),
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  change_summary TEXT,
  CONSTRAINT uq_customization_version_firm UNIQUE (firm_id, version_number)
);

-- 7. Account Groups & Chart of Accounts Hierarchy
CREATE TABLE IF NOT EXISTS public.account_groups (
  id TEXT PRIMARY KEY,
  firm_id UUID NOT NULL DEFAULT public.my_firm_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  nature TEXT NOT NULL, -- 'asset', 'liability', 'income', 'expense'
  parent_group_id TEXT,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_account_group_code_firm UNIQUE (firm_id, code)
);

-- 8. Ledger Accounts
CREATE TABLE IF NOT EXISTS public.ledger_accounts (
  id TEXT PRIMARY KEY,
  firm_id UUID NOT NULL DEFAULT public.my_firm_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  group_id TEXT NOT NULL REFERENCES public.account_groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  nature TEXT NOT NULL,
  opening_balance_paise BIGINT NOT NULL DEFAULT 0,
  opening_gold_mg BIGINT NOT NULL DEFAULT 0,
  current_balance_paise BIGINT NOT NULL DEFAULT 0,
  current_gold_mg BIGINT NOT NULL DEFAULT 0,
  is_cash_or_bank BOOLEAN NOT NULL DEFAULT false,
  bank_account_number TEXT,
  ifsc_code TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_ledger_account_code_firm UNIQUE (firm_id, code)
);

-- 9. Daily Day-Close Reconciliation Logs
CREATE TABLE IF NOT EXISTS public.day_close_records (
  id TEXT PRIMARY KEY,
  firm_id UUID NOT NULL DEFAULT public.my_firm_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id TEXT REFERENCES public.branches(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  closed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  cash_drawer_physical_paise BIGINT NOT NULL DEFAULT 0,
  cash_system_expected_paise BIGINT NOT NULL DEFAULT 0,
  cash_variance_paise BIGINT NOT NULL DEFAULT 0,
  vault_gold_physical_mg BIGINT NOT NULL DEFAULT 0,
  vault_gold_system_expected_mg BIGINT NOT NULL DEFAULT 0,
  gold_variance_mg BIGINT NOT NULL DEFAULT 0,
  verified_by TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'reconciled',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.custom_entity_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_entity_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_book_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gold_ownership_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metal_inventory_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customization_version_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.day_close_records ENABLE ROW LEVEL SECURITY;

-- Multi-tenant firm-scoped RLS policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'custom_entity_definitions' AND policyname = 'Users can manage firm custom entity definitions') THEN
    CREATE POLICY "Users can manage firm custom entity definitions"
      ON public.custom_entity_definitions FOR ALL
      USING (firm_id = public.my_firm_id())
      WITH CHECK (firm_id = public.my_firm_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'custom_entity_records' AND policyname = 'Users can manage firm custom entity records') THEN
    CREATE POLICY "Users can manage firm custom entity records"
      ON public.custom_entity_records FOR ALL
      USING (firm_id = public.my_firm_id())
      WITH CHECK (firm_id = public.my_firm_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'custom_book_definitions' AND policyname = 'Users can manage firm custom books') THEN
    CREATE POLICY "Users can manage firm custom books"
      ON public.custom_book_definitions FOR ALL
      USING (firm_id = public.my_firm_id())
      WITH CHECK (firm_id = public.my_firm_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'gold_ownership_positions' AND policyname = 'Users can view and manage gold ownership positions') THEN
    CREATE POLICY "Users can view and manage gold ownership positions"
      ON public.gold_ownership_positions FOR ALL
      USING (firm_id = public.my_firm_id())
      WITH CHECK (firm_id = public.my_firm_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'metal_inventory_lots' AND policyname = 'Users can view and manage metal inventory lots') THEN
    CREATE POLICY "Users can view and manage metal inventory lots"
      ON public.metal_inventory_lots FOR ALL
      USING (firm_id = public.my_firm_id())
      WITH CHECK (firm_id = public.my_firm_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'customization_version_history' AND policyname = 'Users can view and manage customization version history') THEN
    CREATE POLICY "Users can view and manage customization version history"
      ON public.customization_version_history FOR ALL
      USING (firm_id = public.my_firm_id())
      WITH CHECK (firm_id = public.my_firm_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'account_groups' AND policyname = 'Users can view and manage account groups') THEN
    CREATE POLICY "Users can view and manage account groups"
      ON public.account_groups FOR ALL
      USING (firm_id = public.my_firm_id())
      WITH CHECK (firm_id = public.my_firm_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ledger_accounts' AND policyname = 'Users can view and manage ledger accounts') THEN
    CREATE POLICY "Users can view and manage ledger accounts"
      ON public.ledger_accounts FOR ALL
      USING (firm_id = public.my_firm_id())
      WITH CHECK (firm_id = public.my_firm_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'day_close_records' AND policyname = 'Users can view and manage day close records') THEN
    CREATE POLICY "Users can view and manage day close records"
      ON public.day_close_records FOR ALL
      USING (firm_id = public.my_firm_id())
      WITH CHECK (firm_id = public.my_firm_id());
  END IF;
END $$;
