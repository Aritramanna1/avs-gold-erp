-- Supabase-only security operation history.
-- Replaces retired browser-local backup/key bookkeeping with audited online state.

create table if not exists public.security_operations (
  id text primary key,
  operation_type text not null,
  status text not null default 'recorded',
  summary text,
  details jsonb not null default '{}'::jsonb,
  actor_id uuid references auth.users(id) on delete set null,
  actor_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists security_operations_type_created_idx
  on public.security_operations(operation_type, created_at desc);

alter table public.security_operations enable row level security;

drop policy if exists security_operations_select_authenticated on public.security_operations;
create policy security_operations_select_authenticated
  on public.security_operations
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.user_profiles p
      where p.auth_id = auth.uid()
        and p.role in ('platform_owner', 'superadmin', 'owner', 'admin')
    )
  );

drop policy if exists security_operations_insert_authenticated on public.security_operations;
create policy security_operations_insert_authenticated
  on public.security_operations
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.user_profiles p
      where p.auth_id = auth.uid()
        and p.role in ('platform_owner', 'superadmin', 'owner', 'admin')
    )
  );

drop policy if exists security_operations_update_authenticated on public.security_operations;
create policy security_operations_update_authenticated
  on public.security_operations
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.user_profiles p
      where p.auth_id = auth.uid()
        and p.role in ('platform_owner', 'superadmin', 'owner', 'admin')
    )
  )
  with check (
    exists (
      select 1
      from public.user_profiles p
      where p.auth_id = auth.uid()
        and p.role in ('platform_owner', 'superadmin', 'owner', 'admin')
    )
  );

grant select, insert, update on public.security_operations to authenticated;
