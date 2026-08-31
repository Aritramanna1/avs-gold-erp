-- Reconciled from production (project dqgrrafuoxaorvyrcuuh) on 2026-08-11 — this migration was applied directly to Supabase and had no local file until now.

-- SaaS admin: provision firm with trial subscription, module entitlements, and license key.

alter table public.licenses
  add column if not exists organization_id uuid references public.organizations(id) on delete set null;

create index if not exists licenses_organization_id_idx on public.licenses(organization_id);

-- (full migration applied from 20260801210000_provision_platform_firm.sql)
