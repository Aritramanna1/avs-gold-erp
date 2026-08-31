-- Reconciled from production (project dqgrrafuoxaorvyrcuuh) on 2026-08-11 — this migration was applied directly to Supabase and had no local file until now.

-- Specialist worker payment clearance (polish, meena, stone setting).
-- Variance accrues per completed job; cleared weekly/monthly from Attendance.

CREATE TABLE IF NOT EXISTS public.specialist_work_variances (
  id TEXT PRIMARY KEY,
  firm_id UUID NOT NULL DEFAULT public.my_firm_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id TEXT REFERENCES public.branches(id) ON DELETE SET NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.specialist_payment_clearances (
  id TEXT PRIMARY KEY,
  firm_id UUID NOT NULL DEFAULT public.my_firm_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id TEXT REFERENCES public.branches(id) ON DELETE SET NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.specialist_work_variances TO authenticated;
GRANT ALL ON public.specialist_work_variances TO service_role;
ALTER TABLE public.specialist_work_variances ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.specialist_payment_clearances TO authenticated;
GRANT ALL ON public.specialist_payment_clearances TO service_role;
ALTER TABLE public.specialist_payment_clearances ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
  pol text;
  tables text[] := ARRAY['specialist_work_variances', 'specialist_payment_clearances'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol, t);
    END LOOP;

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (firm_id = public.my_firm_id() OR public.has_role(auth.uid(), ''saas_admin''::public.app_role))',
      t || '_read_authed', t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (firm_id = public.my_firm_id() AND NOT public.has_role(auth.uid(), ''viewer''::public.app_role))',
      t || '_insert_staff', t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING ((firm_id = public.my_firm_id() OR public.has_role(auth.uid(), ''saas_admin''::public.app_role)) AND NOT public.has_role(auth.uid(), ''viewer''::public.app_role)) WITH CHECK (firm_id = public.my_firm_id() AND NOT public.has_role(auth.uid(), ''viewer''::public.app_role))',
      t || '_update_staff', t
    );
  END LOOP;
END $$;
