-- Additive migration: bring kjfjsfhftytezsjyegmb schema in line with app code.
-- Adds tables/columns/function missing from this project's independent migration
-- history. Every statement is guarded (IF NOT EXISTS / CREATE OR REPLACE / DROP
-- ... IF EXISTS) so it is safe to run even if some pieces already exist.

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- orders
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

-- job_cards
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

-- inventory
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

-- invoices
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

-- repairs
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

-- missing columns on existing tables
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS branch_type text NOT NULL DEFAULT 'retail';
ALTER TABLE public.branches DROP CONSTRAINT IF EXISTS branches_branch_type_check;
ALTER TABLE public.branches ADD CONSTRAINT branches_branch_type_check CHECK (branch_type IN ('retail', 'manufacturing'));
ALTER TABLE public.workshops ADD COLUMN IF NOT EXISTS data jsonb NOT NULL DEFAULT '{}'::jsonb;

-- document_sequences + generate_sequential_number RPC (idempotent; table already exists)
CREATE TABLE IF NOT EXISTS public.document_sequences (
    type text NOT NULL,
    prefix text NOT NULL,
    last_value integer NOT NULL DEFAULT 0,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT document_sequences_pkey PRIMARY KEY (type, prefix)
);
ALTER TABLE public.document_sequences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated sequence modification" ON public.document_sequences;
CREATE POLICY "Allow authenticated sequence modification" ON public.document_sequences
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.generate_sequential_number(p_type text, p_prefix text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_current_date date;
    v_year integer;
    v_month integer;
    v_fy_start integer;
    v_fy_end integer;
    v_fy_str text;
    v_type_prefix text;
    v_final_prefix text;
    v_last_val integer;
    v_padded_val text;
BEGIN
    v_current_date := CURRENT_DATE;
    v_year := extract(year from v_current_date)::integer;
    v_month := extract(month from v_current_date)::integer;

    IF v_month >= 4 THEN
        v_fy_start := v_year;
        v_fy_end := v_year + 1;
    ELSE
        v_fy_start := v_year - 1;
        v_fy_end := v_year;
    END IF;

    v_fy_str := right(v_fy_start::text, 2) || '-' || right(v_fy_end::text, 2);

    IF p_type = 'jobcard' OR p_type = 'job_cards' THEN
        v_type_prefix := 'JC';
        v_final_prefix := v_type_prefix || '-' || v_fy_str || '-';
    ELSIF p_type = 'order' OR p_type = 'orders' THEN
        v_type_prefix := 'ORD';
        v_final_prefix := v_type_prefix || '-' || v_fy_str || '-';
    ELSIF p_type = 'invoice' OR p_type = 'invoices' THEN
        v_type_prefix := 'MTJ';
        v_final_prefix := v_type_prefix || '/' || v_fy_str || '/';
    ELSIF p_type = 'repair' OR p_type = 'repairs' THEN
        v_type_prefix := 'RP';
        v_final_prefix := v_type_prefix || '-' || v_fy_str || '-';
    ELSIF p_type = 'gold_settlement' OR p_type = 'expense' OR p_type = 'voucher' THEN
        v_type_prefix := 'EXP';
        v_final_prefix := v_type_prefix || '-' || v_fy_str || '-';
    ELSE
        IF p_prefix IS NOT NULL AND p_prefix <> '' THEN
            v_final_prefix := p_prefix;
        ELSE
            v_final_prefix := upper(p_type) || '-' || v_fy_str || '-';
        END IF;
    END IF;

    INSERT INTO public.document_sequences (type, prefix, last_value, updated_at)
    VALUES (p_type, v_final_prefix, 1, timezone('utc'::text, now()))
    ON CONFLICT (type, prefix)
    DO UPDATE SET
        last_value = document_sequences.last_value + 1,
        updated_at = timezone('utc'::text, now())
    RETURNING last_value INTO v_last_val;

    v_padded_val := lpad(v_last_val::text, 4, '0');
    RETURN v_final_prefix || v_padded_val;
END;
$$;
