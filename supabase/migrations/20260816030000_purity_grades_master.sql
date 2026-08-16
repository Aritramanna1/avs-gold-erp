-- AVS / Ornexa — Stamp / Purity master (firm-scoped)
-- Master References: JWELLY_REFERENCE_MASTER.md, JEWELLERY_INDUSTRY_BASELINE_MATRIX.md

CREATE TABLE IF NOT EXISTS public.purity_grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL DEFAULT public.my_firm_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  metal_type TEXT NOT NULL DEFAULT 'gold',
  karat_label TEXT NOT NULL,
  touch_permille INT NOT NULL,
  hallmark_seal TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_system BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_purity_grade_firm_touch UNIQUE (firm_id, metal_type, touch_permille),
  CONSTRAINT purity_grades_metal_type_check CHECK (metal_type IN ('gold', 'silver', 'platinum')),
  CONSTRAINT purity_grades_touch_check CHECK (touch_permille >= 0 AND touch_permille <= 999)
);

CREATE INDEX IF NOT EXISTS purity_grades_firm_metal_idx
  ON public.purity_grades (firm_id, metal_type, sort_order);

ALTER TABLE public.purity_grades ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'purity_grades' AND policyname = 'Users can manage firm purity grades'
  ) THEN
    CREATE POLICY "Users can manage firm purity grades"
      ON public.purity_grades FOR ALL
      USING (firm_id = public.my_firm_id())
      WITH CHECK (firm_id = public.my_firm_id());
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.purity_grades TO authenticated;

-- Seed treasury voucher transaction definitions (system-wide, firm_id null)
INSERT INTO public.universal_transaction_definitions (
  code, name, category, counterparty_type, fields_schema, posting_rules, is_system, is_active
)
SELECT v.code, v.name, v.category, v.counterparty_type, v.fields_schema::jsonb, v.posting_rules::jsonb, true, true
FROM (VALUES
  (
    'CASH_RECEIPT',
    'Cash / Bank Receipt',
    'treasury',
    'optional',
    '[]',
    '{"prefix":"RCP-","movementDirection":"INWARD","lineItemTypes":["payment"],"ledgerImpact":{"moneyLedger":true,"metalLedger":false,"stockLedger":false,"partyLedger":true,"mfgLedger":false,"taxLedger":false},"approvalRule":{"mode":"auto"},"description":"Money received — cash/bank debit."}'
  ),
  (
    'CASH_PAYMENT',
    'Cash / Bank Payment',
    'treasury',
    'optional',
    '[]',
    '{"prefix":"PAY-","movementDirection":"OUTWARD","lineItemTypes":["payment"],"ledgerImpact":{"moneyLedger":true,"metalLedger":false,"stockLedger":false,"partyLedger":true,"mfgLedger":false,"taxLedger":false},"approvalRule":{"mode":"auto"},"description":"Money paid out — cash/bank credit."}'
  ),
  (
    'JOURNAL_VOUCHER',
    'Journal Voucher',
    'treasury',
    'none',
    '[]',
    '{"prefix":"JNL-","movementDirection":"NONE","lineItemTypes":["payment"],"ledgerImpact":{"moneyLedger":true,"metalLedger":false,"stockLedger":false,"partyLedger":false,"mfgLedger":false,"taxLedger":false},"approvalRule":{"mode":"auto"},"description":"Non-cash adjusting entry."}'
  ),
  (
    'CONTRA_VOUCHER',
    'Contra Voucher',
    'treasury',
    'none',
    '[]',
    '{"prefix":"CTR-","movementDirection":"TRANSFER","lineItemTypes":["payment"],"ledgerImpact":{"moneyLedger":true,"metalLedger":false,"stockLedger":false,"partyLedger":false,"mfgLedger":false,"taxLedger":false},"approvalRule":{"mode":"auto"},"description":"Cash/bank transfer between accounts."}'
  )
) AS v(code, name, category, counterparty_type, fields_schema, posting_rules)
WHERE NOT EXISTS (
  SELECT 1 FROM public.universal_transaction_definitions d WHERE d.code = v.code AND d.is_system
);
