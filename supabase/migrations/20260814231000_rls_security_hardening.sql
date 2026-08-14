-- =====================================================================
-- Migration: 20260814231000_rls_security_hardening.sql
-- Description: Multi-Tenant Row Level Security (RLS) Hardening & Function Security Path Fixes
-- Milestone: M1 (Backend Security Hardening & Canonical Schema Alignments)
-- =====================================================================

-- 1. Drop the 35 residual permissive `USING (true)` and un-scoped policies from legacy migrations
DO $$
DECLARE
  t text;
  pol text;
  legacy_pols text[] := ARRAY[
    'people authed all',
    'kyc authed all',
    'ledger authed all',
    'att authed all',
    'salrule authed all',
    'wtx authed all',
    'wset authed all',
    'orders authed all',
    'jc authed all',
    'jps authed all',
    'cat authed all',
    'inv authed all',
    'smv authed all',
    'inv2 authed all',
    'pay authed all',
    'cled authed all',
    'rc authed all',
    'rep authed all',
    'dc authed all',
    'plog authed all',
    'wa authed all',
    'set authed all',
    'ddm authed all',
    'invoices_read_authed',
    'invoices_insert_staff',
    'invoices_update_staff',
    'invoices_delete_staff',
    'metal_conversions_read',
    'metal_conversions_write',
    'gold_ledger_read',
    'gold_ledger_insert',
    'gold_ledger_update',
    'gold_ledger_delete',
    'communication_logs_staff_read',
    'communication_logs_staff_write',
    'Allow authenticated sequence modification',
    'Allow public sequence modification',
    'Allow authenticated read on attachments',
    'Allow authenticated insert on attachments',
    'Allow authenticated update on attachments',
    'Allow authenticated delete on attachments',
    'Allow authenticated read on gold_settlements',
    'Allow authenticated insert on gold_settlements',
    'Allow authenticated update on gold_settlements',
    'Allow authenticated delete on gold_settlements',
    'dropdown_masters_staff_read',
    'dropdown_masters_staff_write',
    'erp_schema_meta_staff_read',
    'erp_schema_meta_staff_write',
    'print_templates_staff_read',
    'print_templates_staff_write'
  ];
BEGIN
  -- Drop specific legacy open policies across all public tables
  FOR t, pol IN
    SELECT p.tablename, p.policyname
    FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND (
        p.policyname = ANY(legacy_pols)
        OR p.policyname ~* 'authed all'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol, t);
  END LOOP;
END $$;

-- 2. Explicitly enable RLS across all core business and operational tables, applying strict tenant isolation
DO $$
DECLARE
  t text;
  pol text;
  business_tables text[] := ARRAY[
    'people', 'kyc_documents', 'gold_ledger', 'attendance', 'salary_rules',
    'worker_transactions', 'worker_settlements', 'orders', 'job_cards',
    'job_process_steps', 'catalog_designs', 'inventory', 'stock_movements',
    'invoices', 'payments', 'customer_ledger', 'rate_cut_records', 'repairs',
    'daily_close', 'print_logs', 'whatsapp_inbox', 'app_settings', 'dropdown_masters',
    'metal_conversions', 'communication_logs', 'attachments', 'gold_settlements',
    'document_sequences', 'erp_schema_meta', 'print_templates', 'workshops',
    'crm_tasks_meetings', 'crm_interactions', 'crm_leads_opportunities', 'branch_settings',
    'manufacturing_bills', 'melt_jobs', 'approval_requests', 'credit_notes',
    'customer_settlements', 'debit_notes', 'delivery_challans', 'estimates',
    'financial_lock_periods', 'lot_batches', 'manufacturing_barcodes',
    'material_vault_movements', 'module_states', 'order_issues',
    'outside_work_labour_charges', 'outside_work_payments', 'outside_work_transactions',
    'polishing_transactions', 'saved_filters', 'stone_details', 'worker_returns',
    'specialist_payment_clearances', 'specialist_work_variances', 'storage_file_metadata'
  ];
  same_firm_read text := '(public.is_saas_admin() OR (firm_id = public.my_firm_id()) OR (firm_id IS NULL AND public.my_firm_id() IS NULL))';
  same_firm_write text := '(public.is_saas_admin() OR (firm_id = public.my_firm_id() AND NOT public.is_customer_role() AND NOT public.has_role(auth.uid(), ''viewer''::public.app_role)) OR (firm_id IS NULL AND public.my_firm_id() IS NULL AND NOT public.is_customer_role() AND NOT public.has_role(auth.uid(), ''viewer''::public.app_role)))';
BEGIN
  FOREACH t IN ARRAY business_tables LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;

    -- Enable RLS
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    -- Ensure firm_id column exists
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'firm_id'
    ) THEN
      BEGIN
        EXECUTE format('ALTER TABLE public.%I ADD COLUMN firm_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE', t);
      EXCEPTION WHEN others THEN
        -- column add fallback
      END;
    END IF;

    -- Drop any duplicate/stale tenant policies
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_tenant_select', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_tenant_insert', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_tenant_update', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_tenant_delete', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_tenant_all', t);

    -- Apply strict firm-scoped policies
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (%s)', t || '_tenant_select', t, same_firm_read);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (%s)', t || '_tenant_insert', t, same_firm_write);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)', t || '_tenant_update', t, same_firm_write, same_firm_write);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (%s)', t || '_tenant_delete', t, same_firm_write);
  END LOOP;
END $$;

-- 3. Explicitly enable RLS and secure Platform-level management tables
DO $$
BEGIN
  -- platform_service_requests
  IF to_regclass('public.platform_service_requests') IS NOT NULL THEN
    ALTER TABLE public.platform_service_requests ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS platform_service_requests_tenant_access ON public.platform_service_requests;
    CREATE POLICY platform_service_requests_tenant_access ON public.platform_service_requests
      FOR ALL TO authenticated
      USING (public.is_saas_admin() OR firm_id = public.my_firm_id())
      WITH CHECK (public.is_saas_admin() OR firm_id = public.my_firm_id());
  END IF;

  -- platform_support_tickets
  IF to_regclass('public.platform_support_tickets') IS NOT NULL THEN
    ALTER TABLE public.platform_support_tickets ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS platform_support_tickets_tenant_access ON public.platform_support_tickets;
    CREATE POLICY platform_support_tickets_tenant_access ON public.platform_support_tickets
      FOR ALL TO authenticated
      USING (public.is_saas_admin() OR firm_id = public.my_firm_id())
      WITH CHECK (public.is_saas_admin() OR firm_id = public.my_firm_id());
  END IF;

  -- platform_conversations
  IF to_regclass('public.platform_conversations') IS NOT NULL THEN
    ALTER TABLE public.platform_conversations ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS platform_conversations_tenant_access ON public.platform_conversations;
    CREATE POLICY platform_conversations_tenant_access ON public.platform_conversations
      FOR ALL TO authenticated
      USING (public.is_saas_admin() OR firm_id = public.my_firm_id())
      WITH CHECK (public.is_saas_admin() OR firm_id = public.my_firm_id());
  END IF;

  -- platform_conversation_messages
  IF to_regclass('public.platform_conversation_messages') IS NOT NULL THEN
    ALTER TABLE public.platform_conversation_messages ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS platform_conversation_messages_tenant_access ON public.platform_conversation_messages;
    CREATE POLICY platform_conversation_messages_tenant_access ON public.platform_conversation_messages
      FOR ALL TO authenticated
      USING (
        public.is_saas_admin()
        OR conversation_id IN (
          SELECT pc.id FROM public.platform_conversations pc
          WHERE pc.firm_id = public.my_firm_id() OR public.is_saas_admin()
        )
      )
      WITH CHECK (
        public.is_saas_admin()
        OR conversation_id IN (
          SELECT pc.id FROM public.platform_conversations pc
          WHERE pc.firm_id = public.my_firm_id() OR public.is_saas_admin()
        )
      );
  END IF;

  -- platform_billing_documents
  IF to_regclass('public.platform_billing_documents') IS NOT NULL THEN
    ALTER TABLE public.platform_billing_documents ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS platform_billing_documents_tenant_select ON public.platform_billing_documents;
    CREATE POLICY platform_billing_documents_tenant_select ON public.platform_billing_documents
      FOR SELECT TO authenticated
      USING (public.is_saas_admin() OR firm_id = public.my_firm_id());
    
    DROP POLICY IF EXISTS platform_billing_documents_admin_all ON public.platform_billing_documents;
    CREATE POLICY platform_billing_documents_admin_all ON public.platform_billing_documents
      FOR ALL TO authenticated
      USING (public.is_saas_admin())
      WITH CHECK (public.is_saas_admin());
  END IF;

  -- platform_alerts
  IF to_regclass('public.platform_alerts') IS NOT NULL THEN
    ALTER TABLE public.platform_alerts ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS platform_alerts_tenant_select ON public.platform_alerts;
    CREATE POLICY platform_alerts_tenant_select ON public.platform_alerts
      FOR SELECT TO authenticated
      USING (public.is_saas_admin() OR firm_id = public.my_firm_id() OR firm_id IS NULL);

    DROP POLICY IF EXISTS platform_alerts_admin_all ON public.platform_alerts;
    CREATE POLICY platform_alerts_admin_all ON public.platform_alerts
      FOR ALL TO authenticated
      USING (public.is_saas_admin())
      WITH CHECK (public.is_saas_admin());
  END IF;

  -- platform_deployments (Platform Owner / SuperAdmin Only)
  IF to_regclass('public.platform_deployments') IS NOT NULL THEN
    ALTER TABLE public.platform_deployments ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS platform_deployments_admin_all ON public.platform_deployments;
    CREATE POLICY platform_deployments_admin_all ON public.platform_deployments
      FOR ALL TO authenticated
      USING (public.is_saas_admin())
      WITH CHECK (public.is_saas_admin());
  END IF;

  -- platform_backup_runs (Platform Owner / SuperAdmin Only)
  IF to_regclass('public.platform_backup_runs') IS NOT NULL THEN
    ALTER TABLE public.platform_backup_runs ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS platform_backup_runs_admin_all ON public.platform_backup_runs;
    CREATE POLICY platform_backup_runs_admin_all ON public.platform_backup_runs
      FOR ALL TO authenticated
      USING (public.is_saas_admin())
      WITH CHECK (public.is_saas_admin());
  END IF;

  -- erp_setup_guard (Platform Owner / SuperAdmin Only)
  IF to_regclass('public.erp_setup_guard') IS NOT NULL THEN
    ALTER TABLE public.erp_setup_guard ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS erp_setup_guard_admin_all ON public.erp_setup_guard;
    CREATE POLICY erp_setup_guard_admin_all ON public.erp_setup_guard
      FOR ALL TO authenticated
      USING (public.is_saas_admin())
      WITH CHECK (public.is_saas_admin());
  END IF;

  -- comm_provider_secrets (Platform Owner / SuperAdmin Only)
  IF to_regclass('public.comm_provider_secrets') IS NOT NULL THEN
    ALTER TABLE public.comm_provider_secrets ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS comm_provider_secrets_admin_all ON public.comm_provider_secrets;
    CREATE POLICY comm_provider_secrets_admin_all ON public.comm_provider_secrets
      FOR ALL TO authenticated
      USING (public.is_saas_admin())
      WITH CHECK (public.is_saas_admin());
  END IF;

  -- platform_credentials (Platform Owner / SuperAdmin Only)
  IF to_regclass('public.platform_credentials') IS NOT NULL THEN
    ALTER TABLE public.platform_credentials ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS platform_credentials_admin_all ON public.platform_credentials;
    CREATE POLICY platform_credentials_admin_all ON public.platform_credentials
      FOR ALL TO authenticated
      USING (public.is_saas_admin())
      WITH CHECK (public.is_saas_admin());
  END IF;
END $$;

-- 4. Harden all SECURITY DEFINER functions in public schema with `SET search_path = public, pg_temp`
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
  LOOP
    BEGIN
      EXECUTE format('ALTER FUNCTION public.%I(%s) SET search_path = public, pg_temp', r.proname, r.args);
    EXCEPTION WHEN others THEN
      -- ignore overload or signature edge cases
    END;
  END LOOP;
END $$;
