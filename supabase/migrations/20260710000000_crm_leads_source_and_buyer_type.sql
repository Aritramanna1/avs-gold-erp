-- Migration: 20260710000000_crm_leads_source_and_buyer_type.sql
-- Description: AVS-102 — Lead Source + Buyer Type on crm_leads_opportunities.
-- Real, structured columns (not folded into the existing `data` JSONB bag)
-- because reporting needs to filter/group by both — the opposite reasoning
-- from 20260706000000's manufacturing_bills.extra_data, which is JSONB
-- specifically because nothing there is ever filtered/queried on directly.
-- DEFAULT 'unknown' so every pre-existing row (and any insert that doesn't
-- set these explicitly) has a real, queryable value rather than NULL.
--
-- Applied for real via the Supabase migration tool — not run by writing
-- this file.
ALTER TABLE public.crm_leads_opportunities
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'unknown'
    CHECK (source IN ('whatsapp', 'instagram', 'facebook', 'walk_in', 'referral', 'phone_call', 'unknown')),
  ADD COLUMN IF NOT EXISTS buyer_type TEXT NOT NULL DEFAULT 'individual'
    CHECK (buyer_type IN ('individual', 'retailer', 'bulk_buyer'));
