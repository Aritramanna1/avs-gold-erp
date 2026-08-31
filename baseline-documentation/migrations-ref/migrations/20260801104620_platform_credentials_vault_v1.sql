-- Reconciled from production (project dqgrrafuoxaorvyrcuuh) on 2026-08-11 — this migration was applied directly to Supabase and had no local file until now.

create table if not exists public.platform_credentials (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  provider text not null,
  secret_encrypted text,
  metadata jsonb not null default '{}'::jsonb,
  rotated_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.platform_credentials enable row level security;

drop policy if exists platform_credentials_admin_meta on public.platform_credentials;
create policy platform_credentials_admin_meta on public.platform_credentials
  for select to authenticated
  using (public.is_saas_admin());

drop trigger if exists platform_credentials_updated_at on public.platform_credentials;
create trigger platform_credentials_updated_at
  before update on public.platform_credentials
  for each row execute function public.platform_touch_updated_at();

grant select on public.platform_credentials to authenticated;

create or replace function public.upsert_platform_credential(
  p_key text,
  p_provider text,
  p_secret text,
  p_metadata jsonb default '{}'::jsonb,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before jsonb;
  v_row public.platform_credentials;
begin
  if not public.is_saas_admin() then
    raise exception 'platform admin role required' using errcode = '42501';
  end if;

  select to_jsonb(c) into v_before
  from public.platform_credentials c
  where key = trim(p_key);

  insert into public.platform_credentials (key, provider, secret_encrypted, metadata, rotated_at, created_by)
  values (trim(p_key), trim(p_provider), p_secret, coalesce(p_metadata, '{}'::jsonb), now(), auth.uid())
  on conflict (key) do update
  set
    provider = excluded.provider,
    secret_encrypted = excluded.secret_encrypted,
    metadata = excluded.metadata,
    rotated_at = now(),
    revoked_at = null,
    updated_at = now()
  returning * into v_row;

  perform public.record_platform_audit(
    case when v_before is null then 'credential.created' else 'credential.rotated' end,
    null,
    'platform_credential',
    v_row.key,
    p_reason,
    v_before,
    to_jsonb(v_row) - 'secret_encrypted'
  );

  return jsonb_build_object('key', v_row.key, 'provider', v_row.provider, 'rotated_at', v_row.rotated_at);
end;
$$;

create or replace function public.revoke_platform_credential(
  p_key text,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before jsonb;
  v_row public.platform_credentials;
begin
  if not public.is_saas_admin() then
    raise exception 'platform admin role required' using errcode = '42501';
  end if;

  select to_jsonb(c) into v_before
  from public.platform_credentials c
  where key = trim(p_key);

  update public.platform_credentials
  set secret_encrypted = null, revoked_at = now(), updated_at = now()
  where key = trim(p_key)
  returning * into v_row;

  if not found then
    raise exception 'credential not found';
  end if;

  perform public.record_platform_audit(
    'credential.revoked',
    null,
    'platform_credential',
    v_row.key,
    p_reason,
    v_before,
    to_jsonb(v_row) - 'secret_encrypted'
  );
end;
$$;

revoke all on function public.upsert_platform_credential(text, text, text, jsonb, text) from public;
grant execute on function public.upsert_platform_credential(text, text, text, jsonb, text) to authenticated;

revoke all on function public.revoke_platform_credential(text, text) from public;
grant execute on function public.revoke_platform_credential(text, text) to authenticated;

insert into public.platform_credentials (key, provider, secret_encrypted, metadata, rotated_at, created_by)
select
  ps.key,
  coalesce(split_part(ps.key, '.', 2), 'unknown'),
  ps.value->>'secret',
  ps.value - 'secret',
  now(),
  null
from public.platform_settings ps
where ps.key like 'credential.%'
  and ps.value->>'secret' is not null
on conflict (key) do nothing;
