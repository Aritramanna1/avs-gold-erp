-- Migration: 20260813063000_branch_rates_overrides.sql
-- Description: Add branch-wise bullion rate override columns to branch_settings table.

ALTER TABLE public.branch_settings
  ADD COLUMN IF NOT EXISTS gold_rate_24k_override_paise bigint,
  ADD COLUMN IF NOT EXISTS gold_rate_22k_override_paise bigint,
  ADD COLUMN IF NOT EXISTS gold_rate_18k_override_paise bigint,
  ADD COLUMN IF NOT EXISTS silver_rate_override_paise bigint;
