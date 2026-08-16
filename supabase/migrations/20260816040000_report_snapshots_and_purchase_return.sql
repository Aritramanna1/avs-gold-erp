-- Report save & verify snapshots for QA audit trail
CREATE TABLE IF NOT EXISTS public.report_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL DEFAULT public.my_firm_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  report_code TEXT NOT NULL,
  report_name TEXT NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  snapshot_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  saved_by UUID,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'saved' CHECK (status IN ('saved', 'verified', 'archived'))
);

CREATE TABLE IF NOT EXISTS public.report_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id UUID NOT NULL REFERENCES public.report_snapshots(id) ON DELETE CASCADE,
  firm_id UUID NOT NULL DEFAULT public.my_firm_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  verified_by UUID,
  verified_by_name TEXT NOT NULL,
  verification_note TEXT,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.report_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_verifications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'report_snapshots' AND policyname = 'firm_report_snapshots') THEN
    CREATE POLICY firm_report_snapshots ON public.report_snapshots
      FOR ALL USING (firm_id = public.my_firm_id()) WITH CHECK (firm_id = public.my_firm_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'report_verifications' AND policyname = 'firm_report_verifications') THEN
    CREATE POLICY firm_report_verifications ON public.report_verifications
      FOR ALL USING (firm_id = public.my_firm_id()) WITH CHECK (firm_id = public.my_firm_id());
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE ON public.report_snapshots TO authenticated;
GRANT SELECT, INSERT ON public.report_verifications TO authenticated;

INSERT INTO public.universal_transaction_definitions (
  code, name, category, counterparty_type, fields_schema, posting_rules, is_system, is_active
)
SELECT 'PURCHASE_RETURN', 'Purchase Return', 'purchase', 'supplier', '[]'::jsonb,
  '{"prefix":"PRTN-","movementDirection":"OUTWARD","lineItemTypes":["metal","payment"],"ledgerImpact":{"moneyLedger":true,"metalLedger":true,"stockLedger":true,"partyLedger":true,"mfgLedger":false,"taxLedger":true},"approvalRule":{"mode":"auto"},"description":"Return goods to supplier with stock and ledger reversal."}'::jsonb,
  true, true
WHERE NOT EXISTS (SELECT 1 FROM public.universal_transaction_definitions WHERE code = 'PURCHASE_RETURN' AND is_system);
