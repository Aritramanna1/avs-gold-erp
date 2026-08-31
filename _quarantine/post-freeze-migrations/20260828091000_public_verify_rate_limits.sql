-- Public verify rate limits (marketing /verify and /doc/* abuse protection)

create table if not exists public.public_verify_rate_limits (
  id uuid primary key default gen_random_uuid(),
  client_key text not null,
  action text not null default 'verify',
  window_start timestamptz not null default date_trunc('hour', now()),
  request_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_key, action, window_start)
);

alter table public.public_verify_rate_limits enable row level security;

drop policy if exists public_verify_rate_limits_service on public.public_verify_rate_limits;
create policy public_verify_rate_limits_service on public.public_verify_rate_limits
  for all to service_role using (true) with check (true);

create or replace function public.check_public_verify_rate_limit(
  p_client_key text,
  p_action text default 'verify',
  p_max_per_hour int default 120
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window timestamptz := date_trunc('hour', now());
  v_count int;
begin
  insert into public.public_verify_rate_limits (client_key, action, window_start, request_count)
  values (p_client_key, p_action, v_window, 1)
  on conflict (client_key, action, window_start)
  do update set
    request_count = public.public_verify_rate_limits.request_count + 1,
    updated_at = now()
  returning request_count into v_count;

  return v_count <= p_max_per_hour;
end;
$$;

revoke all on function public.check_public_verify_rate_limit(text, text, int) from public;
grant execute on function public.check_public_verify_rate_limit(text, text, int) to anon, authenticated, service_role;
