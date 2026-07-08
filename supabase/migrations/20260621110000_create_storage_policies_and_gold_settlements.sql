-- Migration: Create public.gold_settlements table and set up RLS matching existing security standards, plus Storage.objects RLS policies
-- Created at 2026-06-21

-- Create public.gold_settlements table
CREATE TABLE IF NOT EXISTS public.gold_settlements (
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

-- Enable RLS
ALTER TABLE public.gold_settlements ENABLE ROW LEVEL SECURITY;

-- Apply standard RLS policies
DROP POLICY IF EXISTS "Allow authenticated read on gold_settlements" ON public.gold_settlements;
CREATE POLICY "Allow authenticated read on gold_settlements" 
ON public.gold_settlements FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow authenticated insert on gold_settlements" ON public.gold_settlements;
CREATE POLICY "Allow authenticated insert on gold_settlements" 
ON public.gold_settlements FOR INSERT TO authenticated WITH CHECK (
  auth.uid() IS NOT NULL 
  AND NOT public.has_role(auth.uid(), 'viewer'::public.app_role)
);

DROP POLICY IF EXISTS "Allow authenticated update on gold_settlements" ON public.gold_settlements;
CREATE POLICY "Allow authenticated update on gold_settlements" 
ON public.gold_settlements FOR UPDATE TO authenticated USING (
  auth.uid() IS NOT NULL 
  AND NOT public.has_role(auth.uid(), 'viewer'::public.app_role)
) WITH CHECK (
  auth.uid() IS NOT NULL 
  AND NOT public.has_role(auth.uid(), 'viewer'::public.app_role)
);

DROP POLICY IF EXISTS "Allow authenticated delete on gold_settlements" ON public.gold_settlements;
CREATE POLICY "Allow authenticated delete on gold_settlements" 
ON public.gold_settlements FOR DELETE TO authenticated USING (
  auth.uid() IS NOT NULL 
  AND NOT public.has_role(auth.uid(), 'viewer'::public.app_role)
);

-- Add standard set_updated_at trigger
DROP TRIGGER IF EXISTS trg_gset_uat ON public.gold_settlements;
CREATE TRIGGER trg_gset_uat BEFORE UPDATE ON public.gold_settlements FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Enable SELECT/INSERT/UPDATE/DELETE grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gold_settlements TO authenticated;
GRANT ALL ON public.gold_settlements TO service_role;


-- ============== STORAGE POLICIES FOR PRIVATE BUCKETS ==================
-- Ensure authenticated users can read/write to storage.objects for MTJ uploads

DO $$
BEGIN
  DROP POLICY IF EXISTS "Allow authenticated insert on storage objects" ON storage.objects;
  CREATE POLICY "Allow authenticated insert on storage objects"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND NOT public.has_role(auth.uid(), 'viewer'::public.app_role)
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "Allow authenticated select on storage objects" ON storage.objects;
  CREATE POLICY "Allow authenticated select on storage objects"
  ON storage.objects FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "Allow authenticated update on storage objects" ON storage.objects;
  CREATE POLICY "Allow authenticated update on storage objects"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND NOT public.has_role(auth.uid(), 'viewer'::public.app_role)
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND NOT public.has_role(auth.uid(), 'viewer'::public.app_role)
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "Allow authenticated delete on storage objects" ON storage.objects;
  CREATE POLICY "Allow authenticated delete on storage objects"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND NOT public.has_role(auth.uid(), 'viewer'::public.app_role)
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
