-- Jewellery ERP completion: box/tray masters, stock transfer vouchers, bank reconciliation

CREATE TABLE IF NOT EXISTS public.stock_box_trays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL DEFAULT public.my_firm_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id TEXT NOT NULL DEFAULT 'MAIN',
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  tray_type TEXT NOT NULL DEFAULT 'tray' CHECK (tray_type IN ('box', 'tray', 'display')),
  stock_location TEXT NOT NULL DEFAULT 'counter',
  capacity_items INTEGER,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (firm_id, branch_id, code)
);

CREATE TABLE IF NOT EXISTS public.stock_transfer_vouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL DEFAULT public.my_firm_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id TEXT NOT NULL DEFAULT 'MAIN',
  voucher_number TEXT NOT NULL,
  from_location TEXT NOT NULL,
  to_location TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_transit' CHECK (status IN ('draft', 'in_transit', 'received', 'cancelled')),
  item_count INTEGER NOT NULL DEFAULT 0,
  total_gross_mg BIGINT NOT NULL DEFAULT 0,
  total_fine_mg BIGINT NOT NULL DEFAULT 0,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  sent_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  discrepancy_notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (firm_id, voucher_number)
);

CREATE TABLE IF NOT EXISTS public.bank_reconciliation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL DEFAULT public.my_firm_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  bank_account_code TEXT NOT NULL,
  period_from DATE NOT NULL,
  period_to DATE NOT NULL,
  statement_balance_paise BIGINT NOT NULL DEFAULT 0,
  book_balance_paise BIGINT NOT NULL DEFAULT 0,
  cleared_entries JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reconciled', 'archived')),
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_box_trays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transfer_vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_reconciliation_sessions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'stock_box_trays' AND policyname = 'firm_stock_box_trays') THEN
    CREATE POLICY firm_stock_box_trays ON public.stock_box_trays
      FOR ALL USING (firm_id = public.my_firm_id()) WITH CHECK (firm_id = public.my_firm_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'stock_transfer_vouchers' AND policyname = 'firm_stock_transfer_vouchers') THEN
    CREATE POLICY firm_stock_transfer_vouchers ON public.stock_transfer_vouchers
      FOR ALL USING (firm_id = public.my_firm_id()) WITH CHECK (firm_id = public.my_firm_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bank_reconciliation_sessions' AND policyname = 'firm_bank_reconciliation_sessions') THEN
    CREATE POLICY firm_bank_reconciliation_sessions ON public.bank_reconciliation_sessions
      FOR ALL USING (firm_id = public.my_firm_id()) WITH CHECK (firm_id = public.my_firm_id());
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_box_trays TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_transfer_vouchers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_reconciliation_sessions TO authenticated;

INSERT INTO public.universal_transaction_definitions (
  code, name, category, counterparty_type, fields_schema, posting_rules, is_system, is_active
)
SELECT 'STOCK_TRANSFER', 'Stock Transfer Voucher', 'custom', 'none', '[]'::jsonb,
  '{"prefix":"STX-","movementDirection":"TRANSFER","lineItemTypes":["metal"],"ledgerImpact":{"moneyLedger":false,"metalLedger":true,"stockLedger":true,"partyLedger":false,"mfgLedger":false,"taxLedger":false},"approvalRule":{"mode":"auto"},"description":"Branch/vault/counter stock transfer with in-transit custody."}'::jsonb,
  true, true
WHERE NOT EXISTS (SELECT 1 FROM public.universal_transaction_definitions WHERE code = 'STOCK_TRANSFER' AND is_system);
