-- Reconciled from production (project dqgrrafuoxaorvyrcuuh) on 2026-08-11 — this migration was applied directly to Supabase and had no local file until now.

-- See file 20260802240000_rls_multitenant_hardening.sql
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'attachments' AND column_name = 'firm_id' AND data_type = 'text'
  ) THEN
    ALTER TABLE public.attachments
      ALTER COLUMN firm_id TYPE uuid USING NULLIF(firm_id::text, '')::uuid;
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'attachments.firm_id type migration skipped: %', SQLERRM;
END $$;

UPDATE public.people
SET data = coalesce(data, '{}'::jsonb) || jsonb_build_object(
  'fullName', 'QA Bullion Supplier',
  'active', true,
  'type', 'vendor',
  'branchId', null
)
WHERE id = 'qa-vendor-mtj-20260802';

DO $$
DECLARE pol text;
BEGIN
  IF to_regclass('public.attachments') IS NULL THEN RETURN; END IF;
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'attachments'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.attachments', pol);
  END LOOP;

  EXECUTE $p$
    CREATE POLICY attachments_tenant_select ON public.attachments
      FOR SELECT TO authenticated
      USING (
        public.is_saas_admin()
        OR (firm_id IS NOT NULL AND firm_id = public.my_firm_id())
      )
  $p$;

  EXECUTE $p$
    CREATE POLICY attachments_tenant_insert ON public.attachments
      FOR INSERT TO authenticated
      WITH CHECK (
        NOT public.is_customer_role()
        AND NOT public.has_role(auth.uid(), 'viewer'::public.app_role)
        AND firm_id IS NOT NULL
        AND firm_id = public.my_firm_id()
      )
  $p$;

  EXECUTE $p$
    CREATE POLICY attachments_tenant_update ON public.attachments
      FOR UPDATE TO authenticated
      USING (
        NOT public.is_customer_role()
        AND NOT public.has_role(auth.uid(), 'viewer'::public.app_role)
        AND firm_id = public.my_firm_id()
      )
      WITH CHECK (firm_id = public.my_firm_id())
  $p$;

  EXECUTE $p$
    CREATE POLICY attachments_tenant_delete ON public.attachments
      FOR DELETE TO authenticated
      USING (
        NOT public.is_customer_role()
        AND NOT public.has_role(auth.uid(), 'viewer'::public.app_role)
        AND firm_id = public.my_firm_id()
      )
  $p$;
END $$;

DROP POLICY IF EXISTS storage_file_metadata_select ON public.storage_file_metadata;
CREATE POLICY storage_file_metadata_select ON public.storage_file_metadata
  FOR SELECT TO authenticated
  USING (
    firm_id = public.my_firm_id()
    AND (
      public.is_saas_admin()
      OR public.has_role(auth.uid(), 'owner'::public.app_role)
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
      OR branch_id IS NULL
      OR branch_id = (SELECT up.branch_id FROM public.user_profiles up WHERE up.auth_id = auth.uid() LIMIT 1)
    )
  );
