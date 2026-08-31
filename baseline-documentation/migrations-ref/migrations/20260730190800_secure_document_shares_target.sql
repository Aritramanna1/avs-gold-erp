begin;
create table if not exists public.document_shares (
  id uuid primary key default gen_random_uuid(),
  document_type text not null,
  document_id text not null,
  firm_snapshot jsonb not null default '{}'::jsonb,
  document_snapshot jsonb not null default '{}'::jsonb,
  token_hash text not null unique,
  expires_at timestamptz not null default now() + interval '7 days',
  revoked_at timestamptz,
  max_views integer check (max_views is null or max_views > 0),
  view_count integer not null default 0 check (view_count >= 0),
  last_accessed_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  branch_id text
);
alter table public.document_shares add column if not exists token_hash text not null default '';
alter table public.document_shares add column if not exists revoked_at timestamptz;
alter table public.document_shares add column if not exists max_views integer;
alter table public.document_shares add column if not exists view_count integer not null default 0;
alter table public.document_shares add column if not exists last_accessed_at timestamptz;
create unique index if not exists document_shares_token_hash_idx on public.document_shares(token_hash) where token_hash is not null;
drop policy if exists public_read_non_expired on public.document_shares;
drop policy if exists authenticated_insert on public.document_shares;
drop policy if exists owner_delete on public.document_shares;
alter table public.document_shares enable row level security;
create policy document_shares_owner_select on public.document_shares for select to authenticated using (created_by = auth.uid() or public.is_saas_admin());
create policy document_shares_owner_insert on public.document_shares for insert to authenticated with check (created_by = auth.uid() and document_type not in ('kyc','aadhaar','internal_audit','worker_legal'));
create policy document_shares_owner_update on public.document_shares for update to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy document_shares_owner_delete on public.document_shares for delete to authenticated using (created_by = auth.uid() or public.is_saas_admin());
revoke all on public.document_shares from anon;
grant select,insert,update,delete on public.document_shares to authenticated;
commit;
