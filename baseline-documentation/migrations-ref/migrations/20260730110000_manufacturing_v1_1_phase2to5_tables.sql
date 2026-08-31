-- V1.1 Manufacturing Implementation — Phases 2-5 backing tables.
-- All three are plain createRepository("...") tables (id + data jsonb, same
-- minimal shape as melt_jobs/manufacturing_bills) — the actual gold
-- accounting lives entirely in gold_ledger; these only hold each workflow's
-- own history/audit record (batch numbers, operator, loss/recovery figures).
-- RLS mirrors the existing staff-write / no-viewer-write pattern already
-- applied to every other business table (20260619232538).

CREATE TABLE IF NOT EXISTS public.metal_conversions (
  id text PRIMARY KEY,
  firm_id uuid NOT NULL DEFAULT public.my_firm_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id text REFERENCES public.branches(id) ON DELETE SET NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.metal_conversions TO authenticated;
GRANT ALL ON public.metal_conversions TO service_role;
ALTER TABLE public.metal_conversions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.workshop_process_transactions (
  id text PRIMARY KEY,
  firm_id uuid NOT NULL DEFAULT public.my_firm_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id text REFERENCES public.branches(id) ON DELETE SET NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workshop_process_transactions TO authenticated;
GRANT ALL ON public.workshop_process_transactions TO service_role;
ALTER TABLE public.workshop_process_transactions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.customer_gold_deposits (
  id text PRIMARY KEY,
  firm_id uuid NOT NULL DEFAULT public.my_firm_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id text REFERENCES public.branches(id) ON DELETE SET NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_gold_deposits TO authenticated;
GRANT ALL ON public.customer_gold_deposits TO service_role;
ALTER TABLE public.customer_gold_deposits ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
  pol text;
  tables text[] := ARRAY[
    'metal_conversions','workshop_process_transactions','customer_gold_deposits'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname='public' AND tablename=t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol, t);
    END LOOP;

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (firm_id = public.my_firm_id() OR public.has_role(auth.uid(), ''saas_admin''::public.app_role))',
      t||'_read_authed', t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (firm_id = public.my_firm_id() AND NOT public.has_role(auth.uid(), ''viewer''::public.app_role))',
      t||'_insert_staff', t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING ((firm_id = public.my_firm_id() OR public.has_role(auth.uid(), ''saas_admin''::public.app_role)) AND NOT public.has_role(auth.uid(), ''viewer''::public.app_role)) WITH CHECK (firm_id = public.my_firm_id() AND NOT public.has_role(auth.uid(), ''viewer''::public.app_role))',
      t||'_update_staff', t
    );
  END LOOP;
END $$;
