-- Document hosting retention + metadata (1-year default, plan-configurable max).
-- Access still via resolve_document_share RPC — no raw storage URLs.

begin;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

alter table public.document_shares
  add column if not exists party_id text,
  add column if not exists form_metadata jsonb not null default '{}'::jsonb,
  add column if not exists retention_expires_at timestamptz,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists share_status text not null default 'active'
    check (share_status in ('active', 'revoked', 'expired', 'archived'));

-- Backfill retention from expires_at for existing rows
update public.document_shares
set retention_expires_at = coalesce(retention_expires_at, expires_at)
where retention_expires_at is null;

-- Default new shares: 1 year access window (matches app DEFAULT_DOCUMENT_HOSTING_DAYS)
alter table public.document_shares
  alter column expires_at set default (now() + interval '365 days');

create index if not exists document_shares_retention_expires_idx
  on public.document_shares (retention_expires_at)
  where share_status = 'active';

create index if not exists document_shares_party_id_idx
  on public.document_shares (party_id)
  where party_id is not null;

-- Lightweight API abuse protection: per-key sliding window (server-side).
create table if not exists public.api_rate_limits (
  id bigserial primary key,
  rate_key text not null,
  window_start timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  constraint api_rate_limits_key_window unique (rate_key, window_start)
);

create index if not exists api_rate_limits_key_start_idx
  on public.api_rate_limits (rate_key, window_start desc);

alter table public.api_rate_limits enable row level security;

-- Only service role / security definer functions may read/write rate limits.
revoke all on public.api_rate_limits from anon, authenticated;

create or replace function public.check_api_rate_limit(
  p_key text,
  p_max_requests integer default 30,
  p_window_seconds integer default 60
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_window timestamptz;
  v_count integer;
begin
  if p_key is null or length(p_key) < 3 then
    return false;
  end if;
  if p_max_requests < 1 or p_window_seconds < 1 then
    return true;
  end if;

  v_window := date_trunc('minute', now());

  insert into public.api_rate_limits (rate_key, window_start, request_count)
  values (p_key, v_window, 1)
  on conflict (rate_key, window_start)
  do update set request_count = public.api_rate_limits.request_count + 1
  returning request_count into v_count;

  return v_count <= p_max_requests;
end;
$$;

revoke all on function public.check_api_rate_limit(text, integer, integer) from public;
grant execute on function public.check_api_rate_limit(text, integer, integer) to anon, authenticated;

create or replace function public.resolve_document_share(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_share public.document_shares;
  v_hash text;
  v_rate_ok boolean;
begin
  if p_token is null or length(p_token) < 48 then
    return null;
  end if;

  v_rate_ok := public.check_api_rate_limit(
    'doc_share:' || left(encode(extensions.digest(p_token::bytea, 'sha256'::text), 'hex'), 16),
    20,
    60
  );
  if not v_rate_ok then
    return null;
  end if;

  v_hash := encode(extensions.digest(p_token::bytea, 'sha256'::text), 'hex');

  select * into v_share
  from public.document_shares
  where token_hash = v_hash
    and revoked_at is null
    and share_status = 'active'
    and expires_at > now()
    and (retention_expires_at is null or retention_expires_at > now())
    and (max_views is null or view_count < max_views)
  for update;

  if not found then
    return null;
  end if;

  update public.document_shares
  set view_count = view_count + 1,
      last_accessed_at = now(),
      updated_at = now()
  where id = v_share.id;

  return jsonb_build_object(
    'id', v_share.id,
    'document_type', v_share.document_type,
    'document_id', v_share.document_id,
    'party_id', v_share.party_id,
    'firm_snapshot', v_share.firm_snapshot,
    'document_snapshot', v_share.document_snapshot,
    'form_metadata', v_share.form_metadata,
    'expires_at', v_share.expires_at,
    'retention_expires_at', v_share.retention_expires_at,
    'created_at', v_share.created_at,
    'branch_id', v_share.branch_id
  );
end;
$$;

revoke all on function public.resolve_document_share(text) from public, authenticated;
grant execute on function public.resolve_document_share(text) to anon;

commit;
