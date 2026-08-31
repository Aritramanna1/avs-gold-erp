-- Client code (base-repository.ts and friends) does not set firm_id on
-- insert for any of the 37 firm-scoped tables from
-- 20260730160000_firm_scope_rls_framework.sql. For a user whose
-- my_firm_id() is non-NULL, that insert now lands firm_id = NULL, which
-- fails that migration's own WITH CHECK (firm_id = my_firm_id() OR
-- (firm_id IS NULL AND my_firm_id() IS NULL)) — e.g. catalog_designs insert
-- during e2e seeding. Root-cause fix: auto-populate firm_id from
-- my_firm_id() before the RLS check runs, once, for every affected table,
-- instead of patching each store/repository call site individually.

CREATE OR REPLACE FUNCTION public.set_firm_id_default()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.firm_id IS NULL THEN
    NEW.firm_id := public.my_firm_id();
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'rate_cut_records','gold_ledger','whatsapp_inbox','daily_close','print_logs','salary_rules',
    'worker_transactions','jeweller_transactions','whatsapp_templates','dropdown_masters','app_settings',
    'crm_tasks_meetings','inventory','kyc_documents','stock_movements','people','gold_settlements',
    'crm_interactions','melt_jobs','branch_settings','invitations','repairs','job_process_steps',
    'customer_ledger','communication_logs','job_cards','attendance','manufacturing_bills',
    'attachments','invoices','payments','catalog_designs','document_sequences','worker_settlements',
    'orders','crm_leads_opportunities'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      CONTINUE;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'firm_id'
    ) THEN
      CONTINUE;
    END IF;
    EXECUTE format('DROP TRIGGER IF EXISTS trg_set_firm_id_default ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_set_firm_id_default BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_firm_id_default()',
      t
    );
  END LOOP;
END $$;
