-- =====================================================================
-- MTJ ERP — IDEMPOTENT full schema bundle for Option B (external Supabase)
-- Project ref: kjfjsfhftytezsjyegmb
-- Apply this entire file in the Supabase SQL Editor of the new project.
-- Order: tables + permissive policies, roles + owner trigger, strict policies.
-- Units: gold = mg (bigint), money = paise (bigint), purity = per-mille (smallint).
-- =====================================================================

-- =====================================================================
-- PART 1: Base tables, permissive policies, and updated_at trigger
-- =====================================================================

-- Shared updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- ============== PEOPLE ===============================================
CREATE TABLE IF NOT EXISTS public.people (
  id text PRIMARY KEY,
  firm_id uuid,
  type text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  full_name text NOT NULL,
  phone text,
  whatsapp text,
  email text,
  village_city text,
  current_address text,
  permanent_address text,
  gstin text,
  pan text,
  aadhaar_masked text,
  work_type text,
  salary_rule_id text,
  notes text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.people TO authenticated;
GRANT ALL ON public.people TO service_role;
ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "people authed all" ON public.people;
CREATE POLICY "people authed all" ON public.people FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS trg_people_uat ON public.people;
CREATE TRIGGER trg_people_uat BEFORE UPDATE ON public.people FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============== KYC DOCUMENTS ========================================
CREATE TABLE IF NOT EXISTS public.kyc_documents (
  id text PRIMARY KEY,
  person_id text NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  firm_id uuid,
  kind text NOT NULL,
  storage_path text,
  data_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kyc_documents TO authenticated;
GRANT ALL ON public.kyc_documents TO service_role;
ALTER TABLE public.kyc_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "kyc authed all" ON public.kyc_documents;
CREATE POLICY "kyc authed all" ON public.kyc_documents FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS trg_kyc_uat ON public.kyc_documents;
CREATE TRIGGER trg_kyc_uat BEFORE UPDATE ON public.kyc_documents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============== GOLD LEDGER ==========================================
CREATE TABLE IF NOT EXISTS public.gold_ledger (
  id text PRIMARY KEY,
  firm_id uuid,
  ts timestamptz NOT NULL DEFAULT now(),
  movement text NOT NULL,
  net_fine_mg bigint NOT NULL,
  bucket_deltas jsonb NOT NULL DEFAULT '{}'::jsonb,
  reference text,
  note text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gold_ledger TO authenticated;
GRANT ALL ON public.gold_ledger TO service_role;
ALTER TABLE public.gold_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ledger authed all" ON public.gold_ledger;
CREATE POLICY "ledger authed all" ON public.gold_ledger FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS trg_ledger_uat ON public.gold_ledger;
CREATE TRIGGER trg_ledger_uat BEFORE UPDATE ON public.gold_ledger FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============== ATTENDANCE & WORKER ==================================
CREATE TABLE IF NOT EXISTS public.attendance (
  id text PRIMARY KEY,
  firm_id uuid,
  worker_id text NOT NULL,
  date date NOT NULL,
  status text NOT NULL,
  hours numeric(5,2),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance TO authenticated;
GRANT ALL ON public.attendance TO service_role;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "att authed all" ON public.attendance;
CREATE POLICY "att authed all" ON public.attendance FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS trg_att_uat ON public.attendance;
CREATE TRIGGER trg_att_uat BEFORE UPDATE ON public.attendance FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.salary_rules (
  id text PRIMARY KEY,
  firm_id uuid,
  name text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.salary_rules TO authenticated;
GRANT ALL ON public.salary_rules TO service_role;
ALTER TABLE public.salary_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "salrule authed all" ON public.salary_rules;
CREATE POLICY "salrule authed all" ON public.salary_rules FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS trg_salrule_uat ON public.salary_rules;
CREATE TRIGGER trg_salrule_uat BEFORE UPDATE ON public.salary_rules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.worker_transactions (
  id text PRIMARY KEY,
  firm_id uuid,
  worker_id text NOT NULL,
  kind text NOT NULL,
  ts timestamptz NOT NULL DEFAULT now(),
  amount_paise bigint NOT NULL DEFAULT 0,
  gold_mg bigint NOT NULL DEFAULT 0,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.worker_transactions TO authenticated;
GRANT ALL ON public.worker_transactions TO service_role;
ALTER TABLE public.worker_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wtx authed all" ON public.worker_transactions;
CREATE POLICY "wtx authed all" ON public.worker_transactions FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS trg_wtx_uat ON public.worker_transactions;
CREATE TRIGGER trg_wtx_uat BEFORE UPDATE ON public.worker_transactions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.worker_settlements (
  id text PRIMARY KEY,
  firm_id uuid,
  worker_id text NOT NULL,
  period_from date,
  period_to date,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.worker_settlements TO authenticated;
GRANT ALL ON public.worker_settlements TO service_role;
ALTER TABLE public.worker_settlements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wset authed all" ON public.worker_settlements;
CREATE POLICY "wset authed all" ON public.worker_settlements FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS trg_wset_uat ON public.worker_settlements;
CREATE TRIGGER trg_wset_uat BEFORE UPDATE ON public.worker_settlements FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============== ORDERS & JOB CARDS ===================================
CREATE TABLE IF NOT EXISTS public.orders (
  id text PRIMARY KEY,
  firm_id uuid,
  order_no text NOT NULL,
  type text NOT NULL,
  status text NOT NULL,
  customer_id text REFERENCES public.people(id) ON DELETE SET NULL,
  karigar_id text REFERENCES public.people(id) ON DELETE SET NULL,
  expected_delivery date,
  priority text NOT NULL DEFAULT 'normal',
  source text NOT NULL DEFAULT 'manual',
  whatsapp_source_id text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "orders authed all" ON public.orders;
CREATE POLICY "orders authed all" ON public.orders FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS trg_orders_uat ON public.orders;
CREATE TRIGGER trg_orders_uat BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.job_cards (
  id text PRIMARY KEY,
  firm_id uuid,
  job_no text NOT NULL,
  order_id text REFERENCES public.orders(id) ON DELETE SET NULL,
  karigar_id text REFERENCES public.people(id) ON DELETE SET NULL,
  status text NOT NULL,
  template_key text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_cards TO authenticated;
GRANT ALL ON public.job_cards TO service_role;
ALTER TABLE public.job_cards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "jc authed all" ON public.job_cards;
CREATE POLICY "jc authed all" ON public.job_cards FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS trg_jc_uat ON public.job_cards;
CREATE TRIGGER trg_jc_uat BEFORE UPDATE ON public.job_cards FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.job_process_steps (
  id text PRIMARY KEY,
  job_id text NOT NULL REFERENCES public.job_cards(id) ON DELETE CASCADE,
  firm_id uuid,
  ordinal int NOT NULL,
  name text NOT NULL,
  status text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_process_steps TO authenticated;
GRANT ALL ON public.job_process_steps TO service_role;
ALTER TABLE public.job_process_steps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "jps authed all" ON public.job_process_steps;
CREATE POLICY "jps authed all" ON public.job_process_steps FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS trg_jps_uat ON public.job_process_steps;
CREATE TRIGGER trg_jps_uat BEFORE UPDATE ON public.job_process_steps FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============== CATALOG / STOCK ======================================
CREATE TABLE IF NOT EXISTS public.catalog_designs (
  id text PRIMARY KEY,
  firm_id uuid,
  design_no text,
  name text NOT NULL,
  category text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalog_designs TO authenticated;
GRANT ALL ON public.catalog_designs TO service_role;
ALTER TABLE public.catalog_designs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cat authed all" ON public.catalog_designs;
CREATE POLICY "cat authed all" ON public.catalog_designs FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS trg_cat_uat ON public.catalog_designs;
CREATE TRIGGER trg_cat_uat BEFORE UPDATE ON public.catalog_designs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.inventory (
  id text PRIMARY KEY,
  firm_id uuid,
  item_code text,
  barcode text,
  huid text,
  item_name text NOT NULL,
  category text,
  purity smallint,
  gross_mg bigint NOT NULL DEFAULT 0,
  net_mg bigint NOT NULL DEFAULT 0,
  status text NOT NULL,
  location text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory TO authenticated;
GRANT ALL ON public.inventory TO service_role;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "inv authed all" ON public.inventory;
CREATE POLICY "inv authed all" ON public.inventory FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS trg_inv_uat ON public.inventory;
CREATE TRIGGER trg_inv_uat BEFORE UPDATE ON public.inventory FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.stock_movements (
  id text PRIMARY KEY,
  firm_id uuid,
  item_id text REFERENCES public.inventory(id) ON DELETE SET NULL,
  ts timestamptz NOT NULL DEFAULT now(),
  kind text NOT NULL,
  from_location text,
  to_location text,
  note text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "smv authed all" ON public.stock_movements;
CREATE POLICY "smv authed all" ON public.stock_movements FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS trg_smv_uat ON public.stock_movements;
CREATE TRIGGER trg_smv_uat BEFORE UPDATE ON public.stock_movements FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============== BILLING ==============================================
CREATE TABLE IF NOT EXISTS public.invoices (
  id text PRIMARY KEY,
  firm_id uuid,
  invoice_no text NOT NULL,
  customer_id text REFERENCES public.people(id) ON DELETE SET NULL,
  order_id text REFERENCES public.orders(id) ON DELETE SET NULL,
  status text NOT NULL,
  gst text NOT NULL,
  subtotal_paise bigint NOT NULL DEFAULT 0,
  cgst_paise bigint NOT NULL DEFAULT 0,
  sgst_paise bigint NOT NULL DEFAULT 0,
  gst_paise bigint NOT NULL DEFAULT 0,
  adjustment_paise bigint NOT NULL DEFAULT 0,
  grand_total_paise bigint NOT NULL DEFAULT 0,
  paid_paise bigint NOT NULL DEFAULT 0,
  balance_paise bigint NOT NULL DEFAULT 0,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "inv2 authed all" ON public.invoices;
CREATE POLICY "inv2 authed all" ON public.invoices FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS trg_inv2_uat ON public.invoices;
CREATE TRIGGER trg_inv2_uat BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.payments (
  id text PRIMARY KEY,
  firm_id uuid,
  invoice_id text REFERENCES public.invoices(id) ON DELETE CASCADE,
  ts timestamptz NOT NULL DEFAULT now(),
  mode text NOT NULL,
  amount_paise bigint NOT NULL DEFAULT 0,
  reference text,
  notes text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pay authed all" ON public.payments;
CREATE POLICY "pay authed all" ON public.payments FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS trg_pay_uat ON public.payments;
CREATE TRIGGER trg_pay_uat BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.customer_ledger (
  id text PRIMARY KEY,
  firm_id uuid,
  customer_id text REFERENCES public.people(id) ON DELETE CASCADE,
  ts timestamptz NOT NULL DEFAULT now(),
  kind text NOT NULL,
  ref text,
  description text,
  debit_paise bigint NOT NULL DEFAULT 0,
  credit_paise bigint NOT NULL DEFAULT 0,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_ledger TO authenticated;
GRANT ALL ON public.customer_ledger TO service_role;
ALTER TABLE public.customer_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cled authed all" ON public.customer_ledger;
CREATE POLICY "cled authed all" ON public.customer_ledger FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS trg_cled_uat ON public.customer_ledger;
CREATE TRIGGER trg_cled_uat BEFORE UPDATE ON public.customer_ledger FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.rate_cut_records (
  id text PRIMARY KEY,
  firm_id uuid,
  rate_cut_no text NOT NULL,
  karigar_id text REFERENCES public.people(id) ON DELETE SET NULL,
  job_id text REFERENCES public.job_cards(id) ON DELETE SET NULL,
  overloss_fine_mg bigint NOT NULL DEFAULT 0,
  gold_rate_per_gram_paise bigint NOT NULL DEFAULT 0,
  penalty_paise bigint NOT NULL DEFAULT 0,
  settlement_mode text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rate_cut_records TO authenticated;
GRANT ALL ON public.rate_cut_records TO service_role;
ALTER TABLE public.rate_cut_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rc authed all" ON public.rate_cut_records;
CREATE POLICY "rc authed all" ON public.rate_cut_records FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS trg_rc_uat ON public.rate_cut_records;
CREATE TRIGGER trg_rc_uat BEFORE UPDATE ON public.rate_cut_records FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============== REPAIR ===============================================
CREATE TABLE IF NOT EXISTS public.repairs (
  id text PRIMARY KEY,
  firm_id uuid,
  repair_no text NOT NULL,
  customer_id text REFERENCES public.people(id) ON DELETE SET NULL,
  kind text NOT NULL,
  status text NOT NULL,
  received_gross_mg bigint NOT NULL DEFAULT 0,
  estimated_charge_paise bigint NOT NULL DEFAULT 0,
  advance_paise bigint NOT NULL DEFAULT 0,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.repairs TO authenticated;
GRANT ALL ON public.repairs TO service_role;
ALTER TABLE public.repairs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rep authed all" ON public.repairs;
CREATE POLICY "rep authed all" ON public.repairs FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS trg_rep_uat ON public.repairs;
CREATE TRIGGER trg_rep_uat BEFORE UPDATE ON public.repairs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============== DAILY CLOSE =========================================
CREATE TABLE IF NOT EXISTS public.daily_close (
  id text PRIMARY KEY,
  firm_id uuid,
  date date NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_close TO authenticated;
GRANT ALL ON public.daily_close TO service_role;
ALTER TABLE public.daily_close ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dc authed all" ON public.daily_close;
CREATE POLICY "dc authed all" ON public.daily_close FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS trg_dc_uat ON public.daily_close;
CREATE TRIGGER trg_dc_uat BEFORE UPDATE ON public.daily_close FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============== PRINT LOGS ==========================================
CREATE TABLE IF NOT EXISTS public.print_logs (
  id text PRIMARY KEY,
  firm_id uuid,
  doc_type text NOT NULL,
  doc_number text NOT NULL,
  linked_id text,
  linked_label text,
  printed_by text,
  first_printed_at timestamptz NOT NULL DEFAULT now(),
  last_printed_at timestamptz NOT NULL DEFAULT now(),
  reprint_count int NOT NULL DEFAULT 0,
  history jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.print_logs TO authenticated;
GRANT ALL ON public.print_logs TO service_role;
ALTER TABLE public.print_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "plog authed all" ON public.print_logs;
CREATE POLICY "plog authed all" ON public.print_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS trg_plog_uat ON public.print_logs;
CREATE TRIGGER trg_plog_uat BEFORE UPDATE ON public.print_logs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============== WHATSAPP INBOX ======================================
CREATE TABLE IF NOT EXISTS public.whatsapp_inbox (
  id text PRIMARY KEY,
  firm_id uuid,
  sender_name text,
  sender_phone text,
  raw_text text NOT NULL,
  status text NOT NULL,
  parsed jsonb,
  converted_order_id text REFERENCES public.orders(id) ON DELETE SET NULL,
  linked_person_id text REFERENCES public.people(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_inbox TO authenticated;
GRANT ALL ON public.whatsapp_inbox TO service_role;
ALTER TABLE public.whatsapp_inbox ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wa authed all" ON public.whatsapp_inbox;
CREATE POLICY "wa authed all" ON public.whatsapp_inbox FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS trg_wa_uat ON public.whatsapp_inbox;
CREATE TRIGGER trg_wa_uat BEFORE UPDATE ON public.whatsapp_inbox FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============== SETTINGS / DROPDOWN MASTERS =========================
CREATE TABLE IF NOT EXISTS public.app_settings (
  id text PRIMARY KEY,
  firm_id uuid,
  scope text NOT NULL DEFAULT 'firm',
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "set authed all" ON public.app_settings;
CREATE POLICY "set authed all" ON public.app_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS trg_set_uat ON public.app_settings;
CREATE TRIGGER trg_set_uat BEFORE UPDATE ON public.app_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.dropdown_masters (
  id text PRIMARY KEY,
  firm_id uuid,
  master_key text NOT NULL,
  value text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dropdown_masters TO authenticated;
GRANT ALL ON public.dropdown_masters TO service_role;
ALTER TABLE public.dropdown_masters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ddm authed all" ON public.dropdown_masters;
CREATE POLICY "ddm authed all" ON public.dropdown_masters FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS trg_ddm_uat ON public.dropdown_masters;
CREATE TRIGGER trg_ddm_uat BEFORE UPDATE ON public.dropdown_masters FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================================
-- PART 2: Roles, owner auto-grant, role-check helpers
-- =====================================================================

-- Roles enum and table for MTJ ERP
DO $$ BEGIN
  -- idempotent enum create
DO $do$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='app_role') THEN
  CREATE TYPE public.app_role AS ENUM ('owner','manager','billing','vault','workshop','accountant','viewer');
END IF; END $do$;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own roles" ON public.user_roles;
DROP POLICY IF EXISTS "users read own roles" ON public.user_roles;
CREATE POLICY "users read own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Security-definer role check
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Auto-grant owner role to the configured owner email on signup; viewer to everyone else
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.email = 'games48480@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'owner')
    ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'viewer')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created_role ON auth.users;
CREATE TRIGGER on_auth_user_created_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- Backfill: if the owner already exists in auth.users, grant the role now
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'owner'::public.app_role FROM auth.users WHERE email = 'games48480@gmail.com'
ON CONFLICT DO NOTHING;

-- =====================================================================
-- PART 3: Lock down permissive policies to authenticated + non-viewer
-- =====================================================================

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
