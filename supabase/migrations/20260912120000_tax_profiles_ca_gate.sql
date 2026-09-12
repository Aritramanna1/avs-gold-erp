-- AVS-30 TAX-P0a foundation: firm tax_profiles + CA approval gate columns
-- + invoice audit fields for ruleId / rulePackVersion / tax_breakdown_json.
-- Rates live in profile jsonb (Settings-editable). Production enable requires ca_approved_at.
-- No invented GSTINs / secrets in this migration.

CREATE TABLE IF NOT EXISTS public.tax_profiles (
  firm_id UUID PRIMARY KEY DEFAULT public.my_firm_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- Full TaxProfile payload (jewellerySaleMode, rates, HSN/SAC, flags, rulePackVersion, …)
  profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  ca_approved_at TIMESTAMPTZ,
  ca_approved_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tax_profiles_ca_pair_check CHECK (
    (ca_approved_at IS NULL AND ca_approved_by IS NULL)
    OR (ca_approved_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS tax_profiles_ca_approved_at_idx
  ON public.tax_profiles (ca_approved_at);

COMMENT ON TABLE public.tax_profiles IS
  'Firm tax engine config. CA must set ca_approved_at before production rates apply (AVS-27/AVS-30).';
COMMENT ON COLUMN public.tax_profiles.ca_approved_at IS
  'Non-null unlocks production tax rate application. UI: Awaiting CA approval when null.';

ALTER TABLE public.tax_profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'tax_profiles' AND policyname = 'Users can manage firm tax profiles'
  ) THEN
    CREATE POLICY "Users can manage firm tax profiles"
      ON public.tax_profiles FOR ALL
      USING (firm_id = public.my_firm_id())
      WITH CHECK (firm_id = public.my_firm_id());
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tax_profiles TO authenticated;
GRANT ALL ON public.tax_profiles TO service_role;

-- Invoice persistence for TAX-P0a acceptance (additive, nullable)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'invoices'
  ) THEN
    ALTER TABLE public.invoices
      ADD COLUMN IF NOT EXISTS tax_breakdown_json JSONB,
      ADD COLUMN IF NOT EXISTS rule_id TEXT,
      ADD COLUMN IF NOT EXISTS rule_pack_version TEXT;

    COMMENT ON COLUMN public.invoices.tax_breakdown_json IS
      'Frozen jewellery tax breakdown (inputs → ruleId → output).';
    COMMENT ON COLUMN public.invoices.rule_id IS
      'Tax rule id e.g. GST_COUNCIL_FAQ_GEMS_Q7';
    COMMENT ON COLUMN public.invoices.rule_pack_version IS
      'Firm tax profile rulePackVersion at post time';
  END IF;
END $$;
