-- Centralized unique sequence numbers table and RPC for Orders, Invoices, and Job Cards.
-- This ensures database-level atomic count management, preventing duplicates completely.

CREATE TABLE IF NOT EXISTS public.document_sequences (
    type text NOT NULL,
    prefix text NOT NULL,
    last_value integer NOT NULL DEFAULT 0,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT document_sequences_pkey PRIMARY KEY (type, prefix)
);

-- Enable RLS
ALTER TABLE public.document_sequences ENABLE ROW LEVEL SECURITY;

-- Drop policy if exists and create new one
DROP POLICY IF EXISTS "Allow authenticated sequence modification" ON public.document_sequences;
CREATE POLICY "Allow authenticated sequence modification" ON public.document_sequences
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Drop policy for service role if needed or general public access for testing
DROP POLICY IF EXISTS "Allow public sequence modification" ON public.document_sequences;
CREATE POLICY "Allow public sequence modification" ON public.document_sequences
    FOR ALL TO public USING (true) WITH CHECK (true);

-- Create transactional increment generator function
CREATE OR REPLACE FUNCTION public.generate_sequential_number(p_type text, p_prefix text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_last_val integer;
    v_padded_val text;
BEGIN
    -- Lock table row for transaction isolation to avoid duplicate allocation under high-concurrency race conditions
    INSERT INTO public.document_sequences (type, prefix, last_value, updated_at)
    VALUES (p_type, p_prefix, 1, timezone('utc'::text, now()))
    ON CONFLICT (type, prefix)
    DO UPDATE SET 
        last_value = document_sequences.last_value + 1,
        updated_at = timezone('utc'::text, now())
    RETURNING last_value INTO v_last_val;

    -- Return padded text format
    v_padded_val := lpad(v_last_val::text, 3, '0');
    RETURN p_prefix || v_padded_val;
END;
$$;
