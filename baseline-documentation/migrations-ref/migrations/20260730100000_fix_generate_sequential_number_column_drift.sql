-- PRODUCTION FIX: order/job-card/invoice/repair/gold-settlement creation is
-- failing on every attempt. Root cause: public.document_sequences was
-- reshaped directly against the live database (columns renamed
-- type->doc_type, last_value->last_number, firm_id added NOT NULL with no
-- default) outside of this repo's migration history — 20260625130000's
-- generate_sequential_number() was never updated to match, so it throws
-- `column "type" does not exist` on every call, which fires on every INSERT
-- into orders/job_cards/invoices/repairs/gold_settlements via their
-- BEFORE INSERT triggers.
--
-- public.next_document_number() (the RPC the client actually calls today via
-- src/lib/document-numbering.ts) was ALREADY updated for the new schema and
-- already uses a sentinel firm_id of ...0001 — generate_sequential_number()
-- (server-side trigger path) is the one piece that was missed. Reuse the
-- same sentinel so both paths land in the same counter rows instead of
-- silently splitting into two unrelated sequences.
--
-- No real firm/organization scoping is wired up anywhere else yet (see
-- 20260725110000) — this is a single-tenant placeholder, not per-firm scoping.

ALTER TABLE public.document_sequences
  ALTER COLUMN firm_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;

-- Backfill so ON CONFLICT keeps matching existing rows once callers start
-- passing/omitting firm_id consistently.
UPDATE public.document_sequences SET firm_id = '00000000-0000-0000-0000-000000000001'::uuid
WHERE firm_id IS NULL;

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
    v_firm_id uuid := '00000000-0000-0000-0000-000000000001'::uuid;
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

    -- Sequence row is keyed (firm_id, doc_type) in the live schema — prefix is
    -- stored/updated on the row (so it tracks FY rollover) but is not part of
    -- the conflict key, matching document_sequences_firm_id_doc_type_key.
    INSERT INTO public.document_sequences (firm_id, doc_type, prefix, last_number, updated_at)
    VALUES (v_firm_id, p_type, v_final_prefix, 1, now())
    ON CONFLICT (firm_id, doc_type)
    DO UPDATE SET
        prefix = excluded.prefix,
        last_number = document_sequences.last_number + 1,
        updated_at = now()
    RETURNING last_number INTO v_last_val;

    v_padded_val := lpad(v_last_val::text, 4, '0');
    RETURN v_final_prefix || v_padded_val;
END;
$$;
