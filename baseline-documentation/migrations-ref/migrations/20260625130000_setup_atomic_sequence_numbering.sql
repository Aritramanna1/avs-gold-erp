-- Database-generated, atomic, gap-free, and collision-proof sequence numbering.
-- Enforces standard prefix format per financial year (April 1st to March 31st).

-- 1. Create or update document_sequences table if not already exist
CREATE TABLE IF NOT EXISTS public.document_sequences (
    type text NOT NULL,
    prefix text NOT NULL,
    last_value integer NOT NULL DEFAULT 0,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT document_sequences_pkey PRIMARY KEY (type, prefix)
);

-- Ensure correct table permissions
ALTER TABLE public.document_sequences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated sequence modification" ON public.document_sequences;
CREATE POLICY "Allow authenticated sequence modification" ON public.document_sequences
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public sequence modification" ON public.document_sequences;
CREATE POLICY "Allow public sequence modification" ON public.document_sequences
    FOR ALL TO public USING (true) WITH CHECK (true);

-- 2. Create or replace central transaction sequence generator function
CREATE OR REPLACE FUNCTION public.generate_sequential_number(p_type text, p_prefix text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
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
    -- Get current date in Indian timezone/server default
    v_current_date := CURRENT_DATE;
    v_year := extract(year from v_current_date)::integer;
    v_month := extract(month from v_current_date)::integer;

    -- Compute Indian Financial Year (starts 1st April)
    IF v_month >= 4 THEN
        v_fy_start := v_year;
        v_fy_end := v_year + 1;
    ELSE
        v_fy_start := v_year - 1;
        v_fy_end := v_year;
    END IF;

    -- Format YY-YY (e.g., 26-27)
    v_fy_str := right(v_fy_start::text, 2) || '-' || right(v_fy_end::text, 2);

    -- Map prefix by official formats
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

    -- Atomic transactional upsert and locking of the sequence row
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

-- 3. Create BEFORE INSERT Triggers to completely enforce Postgres-generated IDs on the server

-- Trigger function for orders table
CREATE OR REPLACE FUNCTION public.trg_generate_order_no()
RETURNS TRIGGER AS $$
DECLARE
    v_seq text;
BEGIN
    -- If record with same ID already exists, this is an upsert / update -> preserve original order_no
    IF EXISTS (SELECT 1 FROM public.orders WHERE id = NEW.id) THEN
        SELECT order_no, data INTO NEW.order_no, NEW.data FROM public.orders WHERE id = NEW.id;
        RETURN NEW;
    END IF;

    v_seq := public.generate_sequential_number('order');
    NEW.order_no := v_seq;
    
    IF NEW.data IS NOT NULL THEN
        NEW.data := jsonb_set(NEW.data::jsonb, '{orderNo}', to_jsonb(v_seq))::json;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_orders_sequence ON public.orders;
CREATE TRIGGER trg_orders_sequence 
    BEFORE INSERT ON public.orders 
    FOR EACH ROW EXECUTE FUNCTION public.trg_generate_order_no();


-- Trigger function for job_cards table
CREATE OR REPLACE FUNCTION public.trg_generate_job_no()
RETURNS TRIGGER AS $$
DECLARE
    v_seq text;
BEGIN
    IF EXISTS (SELECT 1 FROM public.job_cards WHERE id = NEW.id) THEN
        SELECT job_no, data INTO NEW.job_no, NEW.data FROM public.job_cards WHERE id = NEW.id;
        RETURN NEW;
    END IF;

    v_seq := public.generate_sequential_number('jobcard');
    NEW.job_no := v_seq;
    
    IF NEW.data IS NOT NULL THEN
        NEW.data := jsonb_set(NEW.data::jsonb, '{jobNo}', to_jsonb(v_seq))::json;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_job_cards_sequence ON public.job_cards;
CREATE TRIGGER trg_job_cards_sequence 
    BEFORE INSERT ON public.job_cards 
    FOR EACH ROW EXECUTE FUNCTION public.trg_generate_job_no();


-- Trigger function for invoices table
CREATE OR REPLACE FUNCTION public.trg_generate_invoice_no()
RETURNS TRIGGER AS $$
DECLARE
    v_seq text;
BEGIN
    IF EXISTS (SELECT 1 FROM public.invoices WHERE id = NEW.id) THEN
        SELECT invoice_no, data INTO NEW.invoice_no, NEW.data FROM public.invoices WHERE id = NEW.id;
        RETURN NEW;
    END IF;

    v_seq := public.generate_sequential_number('invoice');
    NEW.invoice_no := v_seq;
    
    IF NEW.data IS NOT NULL THEN
        NEW.data := jsonb_set(NEW.data::jsonb, '{invoiceNo}', to_jsonb(v_seq))::json;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_invoices_sequence ON public.invoices;
CREATE TRIGGER trg_invoices_sequence 
    BEFORE INSERT ON public.invoices 
    FOR EACH ROW EXECUTE FUNCTION public.trg_generate_invoice_no();


-- Trigger function for repairs table
CREATE OR REPLACE FUNCTION public.trg_generate_repair_no()
RETURNS TRIGGER AS $$
DECLARE
    v_seq text;
BEGIN
    IF EXISTS (SELECT 1 FROM public.repairs WHERE id = NEW.id) THEN
        SELECT repair_no, data INTO NEW.repair_no, NEW.data FROM public.repairs WHERE id = NEW.id;
        RETURN NEW;
    END IF;

    v_seq := public.generate_sequential_number('repair');
    NEW.repair_no := v_seq;
    
    IF NEW.data IS NOT NULL THEN
        NEW.data := jsonb_set(NEW.data::jsonb, '{repairNo}', to_jsonb(v_seq))::json;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_repairs_sequence ON public.repairs;
CREATE TRIGGER trg_repairs_sequence 
    BEFORE INSERT ON public.repairs 
    FOR EACH ROW EXECUTE FUNCTION public.trg_generate_repair_no();


-- Trigger function for gold_settlements table
CREATE OR REPLACE FUNCTION public.trg_generate_gold_settlement_id()
RETURNS TRIGGER AS $$
DECLARE
    v_seq text;
BEGIN
    -- Only generate a sequence if it's a temporary client-generated ID
    IF NEW.id IS NULL OR NEW.id = '' OR starts_with(NEW.id, 'gset_') THEN
        v_seq := public.generate_sequential_number('gold_settlement');
        NEW.id := v_seq;
    END IF;

    IF NEW.data IS NOT NULL THEN
        NEW.data := jsonb_set(NEW.data::jsonb, '{id}', to_jsonb(NEW.id))::json;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_gold_settlements_sequence ON public.gold_settlements;
CREATE TRIGGER trg_gold_settlements_sequence 
    BEFORE INSERT ON public.gold_settlements 
    FOR EACH ROW EXECUTE FUNCTION public.trg_generate_gold_settlement_id();
