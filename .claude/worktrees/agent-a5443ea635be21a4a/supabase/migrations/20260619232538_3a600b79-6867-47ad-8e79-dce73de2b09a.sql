-- 1. Lock down SECURITY DEFINER helpers
REVOKE EXECUTE ON FUNCTION public.handle_new_user_role() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- 2. Replace permissive "USING(true) WITH CHECK(true)" policies on every business table.
--    Reads stay open to all signed-in users; writes are denied to the 'viewer' role.
DO $$
DECLARE
  t text;
  pol text;
  tables text[] := ARRAY[
    'app_settings','attendance','catalog_designs','customer_ledger','daily_close',
    'dropdown_masters','gold_ledger','inventory','invoices','job_cards',
    'job_process_steps','kyc_documents','orders','payments','people',
    'print_logs','rate_cut_records','repairs','salary_rules','stock_movements',
    'whatsapp_inbox','worker_settlements','worker_transactions'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- Drop every existing policy on the table (names vary per table).
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname='public' AND tablename=t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol, t);
    END LOOP;

    -- Read: any signed-in user.
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL)',
      t||'_read_authed', t
    );

    -- Write: signed-in AND not a viewer.
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), ''viewer''::public.app_role))',
      t||'_insert_staff', t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), ''viewer''::public.app_role)) WITH CHECK (auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), ''viewer''::public.app_role))',
      t||'_update_staff', t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), ''viewer''::public.app_role))',
      t||'_delete_staff', t
    );
  END LOOP;
END $$;
