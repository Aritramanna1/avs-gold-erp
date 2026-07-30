-- Additive target foundation. Apply only to the target project.
-- No existing business rows are deleted or reassigned.
begin;

do $$ begin
  create type public.app_role as enum ('saas_admin','owner','admin','ceo','manager','accountant','billing','vault','workshop','viewer');
exception when duplicate_object then null; end $$;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  gstin text,
  address text,
  phone text,
  email text,
  logo_url text,
  license_type text not null default 'trial',
  license_expires_at timestamptz,
  is_active boolean not null default true,
  data jsonb not null default '{}'::jsonb,
  onboarding jsonb not null default '{}'::jsonb,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid not null unique references auth.users(id) on delete cascade,
  firm_id uuid references public.organizations(id) on delete restrict,
  branch_id text references public.branches(id) on delete set null,
  full_name text not null,
  phone text,
  status text not null default 'active',
  active boolean not null default true,
  last_login timestamptz,
  role text,
  data jsonb not null default '{}'::jsonb,
  permissions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

alter table public.branches add column if not exists firm_id uuid references public.organizations(id) on delete restrict;

alter table public.organizations enable row level security;
alter table public.user_profiles enable row level security;
alter table public.user_roles enable row level security;

revoke all on public.organizations, public.user_profiles, public.user_roles from anon;
grant select on public.organizations, public.user_profiles, public.user_roles to authenticated;

create index if not exists idx_user_profiles_firm on public.user_profiles(firm_id);
create index if not exists idx_user_profiles_auth on public.user_profiles(auth_id);
create index if not exists idx_user_roles_user on public.user_roles(user_id);
create index if not exists idx_branches_firm on public.branches(firm_id);

commit;
