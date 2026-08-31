-- Secret material is isolated from branch-readable provider metadata.
-- Access is intentionally service-role-only; Edge Functions are the API.
create table if not exists public.comm_provider_secrets (
  id uuid primary key default gen_random_uuid(),
  branch_id text not null references public.branches(id) on delete cascade,
  provider_type text not null,
  secret_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (branch_id, provider_type)
);

alter table public.comm_provider_secrets enable row level security;
revoke all on public.comm_provider_secrets from anon, authenticated;
grant all on public.comm_provider_secrets to service_role;

create or replace function public.touch_comm_provider_secret()
returns trigger language plpgsql security definer set search_path = public
as $$ begin new.updated_at = now(); return new; end $$;

drop trigger if exists comm_provider_secrets_updated_at on public.comm_provider_secrets;
create trigger comm_provider_secrets_updated_at
before update on public.comm_provider_secrets
for each row execute function public.touch_comm_provider_secret();
