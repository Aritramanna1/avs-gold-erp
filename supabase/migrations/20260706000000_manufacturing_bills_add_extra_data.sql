-- Migration: 20260706000000_manufacturing_bills_add_extra_data.sql
-- Description: Gold-first Manufacturing Billing — adds ONE additive JSONB
-- column carrying every order-level auto-collected field (gold received
-- from customer, order-level issue/return, outside-work issue/return,
-- outside-work labour charges, polishing charges, HUID charge, gold
-- credit/advance/adjustment, approval flag, linked source-record ids for
-- dedupe, and reserved extension points for Retail Billing/Customer
-- Portal/Final Barcode) rather than ~20 new structured columns, since none
-- of these are ever filtered/queried on directly — same convention this
-- table already uses for p_entries/mp_entries (JSON text in a structured
-- column). See manufacturing-bill-store.ts's billToDbRow()/dbRowToBill().
--
-- Applied for real via the Supabase migration tool.
ALTER TABLE public.manufacturing_bills
  ADD COLUMN IF NOT EXISTS extra_data JSONB NOT NULL DEFAULT '{}'::jsonb;
