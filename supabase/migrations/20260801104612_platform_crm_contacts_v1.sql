-- Reconciled from production (project dqgrrafuoxaorvyrcuuh) on 2026-08-11 — this migration was applied directly to Supabase and had no local file until now.

create table if not exists public.platform_crm_contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contact_type text not null check (contact_type in ('decision_maker', 'billing', 'technical', 'other')),
  full_name text not null,
  email text,
  phone text,
  notes text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists platform_crm_contacts_org_type_idx
  on public.platform_crm_contacts (organization_id, contact_type);

alter table public.platform_crm_contacts enable row level security;

drop policy if exists platform_crm_contacts_admin on public.platform_crm_contacts;
create policy platform_crm_contacts_admin on public.platform_crm_contacts
  for all to authenticated
  using (public.is_saas_admin())
  with check (public.is_saas_admin());

drop trigger if exists platform_crm_contacts_updated_at on public.platform_crm_contacts;
create trigger platform_crm_contacts_updated_at
  before update on public.platform_crm_contacts
  for each row execute function public.platform_touch_updated_at();

grant select, insert, update, delete on public.platform_crm_contacts to authenticated;
