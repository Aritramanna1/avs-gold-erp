-- PREPARED CLEANUP MIGRATION — NOT APPLIED AUTOMATICALLY.
--
-- Verified across four consecutive stabilization passes: zero runtime
-- references in application source code (no `.from("<table>")` /
-- createRepository<T>("<table>") call for any of these), and re-verified
-- against the live Supabase schema for triggers, views, RLS policies, and
-- functions:
--
--   - gold_issue_register / gold_receive_register: each has one trigger
--     (trg_gold_issue_fine / trg_gold_recv_fine -> calc_fine_gold()) — routine
--     schema-creation boilerplate, not evidence of application use (nothing
--     ever writes a row to these tables).
--   - kyc_documents: one trigger (trg_kyc_uat -> set_updated_at()) — same
--     routine boilerplate, applied uniformly across many tables at creation.
--   - invitations, feature_flags, user_profiles, document_sequences: zero
--     triggers.
--   - No views, RPC functions, or RLS policies reference any of these seven
--     tables beyond the boilerplate above.
--   - document_sequences is EXCLUDED from this list — it is now the live
--     backing store for the atomic document-numbering system
--     (next_document_number() RPC), added during this stabilization pass.
--
-- These tables were scaffolded during an earlier architecture iteration
-- (invitations/feature_flags were superseded by JSON fields embedded in
-- app_settings; the others were never wired to any store) and are safe to
-- drop whenever you choose to. Run this file manually against the database
-- when ready — it is deliberately NOT applied by any automated process.

DROP TABLE IF EXISTS public.invitations CASCADE;
DROP TABLE IF EXISTS public.feature_flags CASCADE;
DROP TABLE IF EXISTS public.user_profiles CASCADE;
DROP TABLE IF EXISTS public.gold_issue_register CASCADE;
DROP TABLE IF EXISTS public.gold_receive_register CASCADE;
DROP TABLE IF EXISTS public.kyc_documents CASCADE;
