begin;
create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid references public.organizations(id) on delete cascade,
  branch_id text references public.branches(id) on delete set null,
  email text not null,
  role public.app_role not null default 'viewer',
  token_hash text unique,
  invited_by uuid references auth.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','accepted','expired','revoked')),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
-- Ensure role column exists with correct type on pre-existing invitations table
alter table public.invitations add column if not exists role public.app_role not null default 'viewer';
alter table public.invitations add column if not exists token_hash text;
alter table public.invitations add column if not exists branch_id text references public.branches(id) on delete set null;
alter table public.invitations add column if not exists invited_by uuid references auth.users(id) on delete set null;
alter table public.invitations add column if not exists expires_at timestamptz not null default now() + interval '7 days';
alter table public.invitations add column if not exists accepted_at timestamptz;
create unique index if not exists idx_invitations_token_hash on public.invitations(token_hash) where token_hash is not null;
create index if not exists idx_invitations_firm on public.invitations(firm_id);
alter table public.invitations enable row level security;
revoke all on public.invitations from anon;
grant select, insert, update on public.invitations to authenticated;
commit;
