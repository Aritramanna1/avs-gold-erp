-- P0 fix: 36 of the 37 flagged core business tables enforce "signed in" but
-- not "same firm" on
-- RLS (USING (auth.uid() IS NOT NULL) from 20260619232538) — any
-- authenticated user can read/write any other firm's orders, invoices,
-- gold_ledger, KYC documents, etc.
--
-- Cannot backfill user_profiles.firm_id or create an organizations row here:
-- live data has 0 rows in organizations, 0 in user_profiles, and the one
-- branches row has firm_id NULL — there is no authoritative source to derive
-- a firm assignment from without fabricating one. That backfill + the actual
-- tenant-onboarding decision is explicitly left to Codex (see
-- CLAUDE_BACKEND_REVIEW_AND_HANDOVER.md).
--
-- What this migration does instead: makes every one of these 37 tables'
-- policies check firm_id, with a safe fallback for the current
-- everything-is-NULL state — `firm_id IS NULL AND my_firm_id() IS NULL`
-- still matches today (no lockout), and the moment a user_profiles row gets
-- a real firm_id and existing data gets backfilled to match, this becomes
-- real per-firm isolation with zero further RLS changes needed.
--
-- saas_admin always passes — platform role, deliberately not firm-scoped.
--
-- user_profiles (the 37th flagged table) is deliberately EXCLUDED here: its
-- live policies ("Users see own profile", "Users update own profile",
-- "Service role can insert profiles") already correctly check
-- auth_id = auth.uid() OR firm_id = my_firm_id(), and a blanket drop+replace
-- would remove the self-access and signup-insert paths this table actually
-- needs. Left untouched.

-- 1) Add firm_id (nullable, non-destructive) to the 8 tables that don't have it yet.
ALTER TABLE public.branch_settings ADD COLUMN IF NOT EXISTS firm_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.crm_interactions ADD COLUMN IF NOT EXISTS firm_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.crm_leads_opportunities ADD COLUMN IF NOT EXISTS firm_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.crm_tasks_meetings ADD COLUMN IF NOT EXISTS firm_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.gold_settlements ADD COLUMN IF NOT EXISTS firm_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.invitations ADD COLUMN IF NOT EXISTS firm_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.manufacturing_bills ADD COLUMN IF NOT EXISTS firm_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.melt_jobs ADD COLUMN IF NOT EXISTS firm_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

-- 2) Rewrite the staff-write/no-viewer-write policy set (from 20260619232538)
-- on all 37 tables to add the firm_id check, keeping the viewer-write
-- restriction and read-for-any-signed-in-user behaviour otherwise unchanged.
DO $$
DECLARE
  t text;
  pol text;
  tables text[] := ARRAY[
    'rate_cut_records','gold_ledger','whatsapp_inbox','daily_close','print_logs','salary_rules',
    'worker_transactions','jeweller_transactions','whatsapp_templates','dropdown_masters','app_settings',
    'crm_tasks_meetings','inventory','kyc_documents','stock_movements','people','gold_settlements',
    'crm_interactions','melt_jobs','branch_settings','invitations','repairs','job_process_steps',
    'customer_ledger','communication_logs','job_cards','attendance','manufacturing_bills',
    'attachments','invoices','payments','catalog_designs','document_sequences','worker_settlements',
    'orders','crm_leads_opportunities'
  ];
  same_firm text := '(firm_id = public.my_firm_id() OR (firm_id IS NULL AND public.my_firm_id() IS NULL) OR public.has_role(auth.uid(), ''saas_admin''::public.app_role))';
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
    -- Drop EVERY existing policy on this table, not just ones matching our
    -- naming convention — different tables in this list got their permissive
    -- policy from different migrations (20260619232538 vs. others), under
    -- different policy names. Postgres OR's multiple permissive policies
    -- together, so leaving any old broad one in place would silently defeat
    -- the firm-scoped policy we're about to add.
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname='public' AND tablename=t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol, t);
    END LOOP;

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL AND %s)',
      t||'_read_authed', t, same_firm
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), ''viewer''::public.app_role) AND %s)',
      t||'_insert_staff', t, same_firm
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), ''viewer''::public.app_role) AND %s) WITH CHECK (auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), ''viewer''::public.app_role) AND %s)',
      t||'_update_staff', t, same_firm, same_firm
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), ''viewer''::public.app_role) AND %s)',
      t||'_delete_staff', t, same_firm
    );
  END LOOP;
END $$;
