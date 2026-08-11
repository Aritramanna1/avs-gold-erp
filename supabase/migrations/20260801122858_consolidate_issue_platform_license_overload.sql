-- Reconciled from production (project dqgrrafuoxaorvyrcuuh) on 2026-08-11 — this migration was applied directly to Supabase and had no local file until now.

-- Consolidate issue_platform_license RPC overloads.
-- 20260801160000 created an 8-arg version; 20260801230000 added a 9-arg version with
-- p_organization_id. Both match 8-arg calls, causing PostgREST "function is not unique".
-- Drop the legacy overload; keep the canonical 9-arg function.

drop function if exists public.issue_platform_license(
  text, text, text, text, integer, timestamptz, jsonb, text
);

revoke all on function public.issue_platform_license(
  text, text, text, text, integer, timestamptz, jsonb, text, uuid
) from public;
grant execute on function public.issue_platform_license(
  text, text, text, text, integer, timestamptz, jsonb, text, uuid
) to authenticated;
