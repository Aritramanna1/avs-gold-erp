-- AVS / ORNEXA ERP — Universal Transaction & Ledger Engine Migration
-- Creates universal_transaction_definitions and universal_ledger_entries with multi-tenant RLS policies.

CREATE TABLE IF NOT EXISTS public.universal_transaction_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'workshop', -- 'workshop', 'billing', 'counterparty', 'inventory'
  counterparty_type TEXT NOT NULL DEFAULT 'none', -- 'customer', 'supplier', 'karigar', 'carrier', 'none'
  fields_schema JSONB NOT NULL DEFAULT '[]'::jsonb,
  posting_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_system BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_tenant_transaction_code UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS public.universal_ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  transaction_definition_id UUID REFERENCES public.universal_transaction_definitions(id) ON DELETE RESTRICT,
  voucher_number TEXT NOT NULL,
  voucher_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  counterparty_id UUID,
  counterparty_name TEXT,
  gross_weight_mg BIGINT NOT NULL DEFAULT 0,
  less_weight_mg BIGINT NOT NULL DEFAULT 0,
  net_weight_mg BIGINT NOT NULL DEFAULT 0,
  fine_gold_debit_mg BIGINT NOT NULL DEFAULT 0,
  fine_gold_credit_mg BIGINT NOT NULL DEFAULT 0,
  fine_silver_debit_mg BIGINT NOT NULL DEFAULT 0,
  fine_silver_credit_mg BIGINT NOT NULL DEFAULT 0,
  cash_debit_paise BIGINT NOT NULL DEFAULT 0,
  cash_credit_paise BIGINT NOT NULL DEFAULT 0,
  stone_carats NUMERIC(10, 4) NOT NULL DEFAULT 0,
  pieces INT NOT NULL DEFAULT 0,
  waiting_on TEXT, -- 'internal', 'customer', 'supplier', 'karigar', 'carrier', 'approval'
  commitment_due_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'posted', -- 'posted', 'reversed', 'draft'
  reversal_ref_id UUID REFERENCES public.universal_ledger_entries(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for ultra-fast ledger querying
CREATE INDEX IF NOT EXISTS idx_universal_ledger_tenant ON public.universal_ledger_entries(tenant_id, voucher_date DESC);
CREATE INDEX IF NOT EXISTS idx_universal_ledger_counterparty ON public.universal_ledger_entries(tenant_id, counterparty_id);
CREATE INDEX IF NOT EXISTS idx_universal_ledger_branch ON public.universal_ledger_entries(tenant_id, branch_id);

-- Enable RLS Security
ALTER TABLE public.universal_transaction_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.universal_ledger_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for universal_transaction_definitions
CREATE POLICY "Tenant users can view transaction definitions"
  ON public.universal_transaction_definitions
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
    ) OR is_system = true
  );

CREATE POLICY "Tenant admins can manage custom transaction definitions"
  ON public.universal_transaction_definitions
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- RLS Policies for universal_ledger_entries
CREATE POLICY "Tenant users can view ledger entries"
  ON public.universal_ledger_entries
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Tenant users can insert posted ledger entries"
  ON public.universal_ledger_entries
  FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
    )
  );

-- Atomic Universal Posting RPC
CREATE OR REPLACE FUNCTION public.rpc_post_universal_transaction(
  p_tenant_id UUID,
  p_branch_id UUID,
  p_transaction_code TEXT,
  p_voucher_number TEXT,
  p_counterparty_id UUID,
  p_counterparty_name TEXT,
  p_gross_weight_mg BIGINT,
  p_net_weight_mg BIGINT,
  p_fine_gold_debit_mg BIGINT,
  p_fine_gold_credit_mg BIGINT,
  p_cash_debit_paise BIGINT,
  p_cash_credit_paise BIGINT,
  p_waiting_on TEXT DEFAULT NULL,
  p_commitment_due_at TIMESTAMPTZ DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_def_id UUID;
  v_entry_id UUID;
BEGIN
  -- Resolve transaction definition
  SELECT id INTO v_def_id
  FROM public.universal_transaction_definitions
  WHERE (tenant_id = p_tenant_id OR is_system = true)
    AND code = p_transaction_code
  LIMIT 1;

  -- Insert atomic immutable ledger entry
  INSERT INTO public.universal_ledger_entries (
    tenant_id,
    branch_id,
    transaction_definition_id,
    voucher_number,
    counterparty_id,
    counterparty_name,
    gross_weight_mg,
    net_weight_mg,
    fine_gold_debit_mg,
    fine_gold_credit_mg,
    cash_debit_paise,
    cash_credit_paise,
    waiting_on,
    commitment_due_at,
    metadata,
    created_by
  ) VALUES (
    p_tenant_id,
    p_branch_id,
    v_def_id,
    p_voucher_number,
    p_counterparty_id,
    p_counterparty_name,
    COALESCE(p_gross_weight_mg, 0),
    COALESCE(p_net_weight_mg, 0),
    COALESCE(p_fine_gold_debit_mg, 0),
    COALESCE(p_fine_gold_credit_mg, 0),
    COALESCE(p_cash_debit_paise, 0),
    COALESCE(p_cash_credit_paise, 0),
    p_waiting_on,
    p_commitment_due_at,
    COALESCE(p_metadata, '{}'::jsonb),
    auth.uid()
  ) RETURNING id INTO v_entry_id;

  RETURN v_entry_id;
END;
$$;
