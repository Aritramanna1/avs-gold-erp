-- Bank reconciliation statement import + public document verification RPCs (shop parity).
-- Append-only, forward-safe.

begin;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- ── Bank reconciliation: imported statement lines ───────────────────────────
alter table public.bank_reconciliation_sessions
  add column if not exists statement_lines jsonb not null default '[]'::jsonb;

comment on column public.bank_reconciliation_sessions.statement_lines is
  'Parsed bank statement CSV rows + auto-match voucher ids (BankStatementLine[]).';

-- ── Public document verification registry ─────────────────────────────────────
create table if not exists public.public_document_verifications (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null default public.my_firm_id()
    references public.organizations(id) on delete cascade,
  doc_type text not null,
  doc_number text not null,
  record_id uuid not null,
  public_token text not null,
  token_hash text not null,
  business_name text not null,
  party_label text,
  invoice_date date,
  total_paise bigint,
  item_summary text,
  document_share_token text,
  status text not null default 'verified'
    check (status in ('verified', 'cancelled', 'revoked')),
  access_expires_at timestamptz,
  legacy_checksum_token text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint public_document_verifications_token_hash_key unique (token_hash),
  constraint public_document_verifications_public_token_key unique (public_token),
  constraint public_document_verifications_firm_doc_record_key unique (firm_id, doc_type, record_id)
);

create index if not exists public_document_verifications_record_idx
  on public.public_document_verifications (firm_id, doc_type, record_id);

alter table public.public_document_verifications enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'public_document_verifications'
      and policyname = 'firm_public_document_verifications'
  ) then
    create policy firm_public_document_verifications
      on public.public_document_verifications
      for all
      using (firm_id = public.my_firm_id())
      with check (firm_id = public.my_firm_id());
  end if;
end $$;

grant select, insert, update, delete on public.public_document_verifications to authenticated;

-- Public verify rate limits (anon /verify abuse guard)
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
revoke all on table public.public_verify_rate_limits from anon, authenticated;

create or replace function public.check_public_verify_rate_limit(
  p_client_key text,
  p_action text default 'verify',
  p_max_per_hour int default 120
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_window timestamptz := date_trunc('hour', now());
  v_count int;
begin
  if p_client_key is null or length(trim(p_client_key)) < 3 then
    return false;
  end if;
  insert into public.public_verify_rate_limits (client_key, action, window_start, request_count)
  values (p_client_key, coalesce(nullif(trim(p_action), ''), 'verify'), v_window, 1)
  on conflict (client_key, action, window_start)
  do update set
    request_count = public.public_verify_rate_limits.request_count + 1,
    updated_at = now()
  returning request_count into v_count;
  return v_count <= greatest(p_max_per_hour, 1);
end;
$$;

revoke all on function public.check_public_verify_rate_limit(text, text, int) from public;
grant execute on function public.check_public_verify_rate_limit(text, text, int)
  to anon, authenticated, service_role;

-- ── mint_invoice_verification (authenticated; firm-scoped) ────────────────────
create or replace function public.mint_invoice_verification(
  p_doc_type text,
  p_doc_number text,
  p_record_id uuid,
  p_business_name text,
  p_party_label text default null,
  p_invoice_date date default null,
  p_total_paise bigint default null,
  p_item_summary text default null,
  p_ttl_hours int default 24,
  p_document_share_token text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_firm uuid := public.my_firm_id();
  v_existing public.public_document_verifications;
  v_token text;
  v_hash text;
  v_expires timestamptz;
begin
  if v_firm is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  perform public.enforce_egress_rate_limit('rpc:mint_invoice_verification', 60, 60);

  select * into v_existing
  from public.public_document_verifications
  where firm_id = v_firm
    and doc_type = p_doc_type
    and record_id = p_record_id
  limit 1;

  if found then
    if v_existing.status in ('cancelled', 'revoked') then
      return jsonb_build_object(
        'ok', false,
        'alreadyExists', true,
        'status', v_existing.status,
        'message', 'Verification revoked for this document.'
      );
    end if;
    return jsonb_build_object(
      'publicToken', v_existing.public_token,
      'accessExpiresAt', v_existing.access_expires_at,
      'alreadyExists', true
    );
  end if;

  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  v_hash := encode(extensions.digest(v_token::bytea, 'sha256'::text), 'hex');
  v_expires := now() + make_interval(hours => greatest(coalesce(p_ttl_hours, 24), 1));

  insert into public.public_document_verifications (
    firm_id, doc_type, doc_number, record_id,
    public_token, token_hash,
    business_name, party_label, invoice_date, total_paise, item_summary,
    document_share_token, access_expires_at, status
  ) values (
    v_firm, p_doc_type, p_doc_number, p_record_id,
    v_token, v_hash,
    coalesce(nullif(trim(p_business_name), ''), 'Business'),
    p_party_label, p_invoice_date, p_total_paise, p_item_summary,
    p_document_share_token, v_expires, 'verified'
  );

  return jsonb_build_object(
    'publicToken', v_token,
    'accessExpiresAt', v_expires,
    'alreadyExists', false
  );
end;
$$;

revoke all on function public.mint_invoice_verification(
  text, text, uuid, text, text, date, bigint, text, int, text
) from public, anon;
grant execute on function public.mint_invoice_verification(
  text, text, uuid, text, text, date, bigint, text, int, text
) to authenticated;

-- ── verify_public_document (anon; no tenant leak via token hash) ──────────────
create or replace function public.verify_public_document(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_token text := trim(coalesce(p_token, ''));
  v_hash text;
  v_row public.public_document_verifications;
  v_rate_key text;
  v_expired boolean := false;
begin
  if length(v_token) < 8 then
    return jsonb_build_object(
      'ok', false,
      'status', 'invalid',
      'message', 'This invoice could not be verified.'
    );
  end if;

  v_rate_key := 'verify:' || left(
    encode(extensions.digest(v_token::bytea, 'sha256'::text), 'hex'),
    16
  );
  if not public.check_api_rate_limit(v_rate_key, 30, 60) then
    return jsonb_build_object(
      'ok', false,
      'status', 'rate_limited',
      'message', 'Too many verification attempts. Please try again shortly.'
    );
  end if;

  v_hash := encode(extensions.digest(v_token::bytea, 'sha256'::text), 'hex');

  select * into v_row
  from public.public_document_verifications
  where token_hash = v_hash
  limit 1;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'status', 'invalid',
      'message', 'This invoice could not be verified.'
    );
  end if;

  if v_row.status in ('cancelled', 'revoked') then
    return jsonb_build_object(
      'ok', false,
      'status', v_row.status,
      'message', 'This invoice is no longer valid.',
      'businessName', v_row.business_name,
      'docType', v_row.doc_type,
      'docNumber', v_row.doc_number
    );
  end if;

  if v_row.access_expires_at is not null and v_row.access_expires_at <= now() then
    v_expired := true;
  end if;

  return jsonb_build_object(
    'ok', not v_expired,
    'status', case when v_expired then 'expired' else 'verified' end,
    'message', case
      when v_expired then 'This verification link has expired.'
      else 'This is a verified invoice.'
    end,
    'businessName', v_row.business_name,
    'docType', v_row.doc_type,
    'docNumber', v_row.doc_number,
    'invoiceDate', v_row.invoice_date,
    'partyLabel', v_row.party_label,
    'totalPaise', v_row.total_paise,
    'itemSummary', v_row.item_summary,
    'accessExpired', v_expired,
    'accessExpiresAt', v_row.access_expires_at,
    'documentShareToken', v_row.document_share_token
  );
end;
$$;

revoke all on function public.verify_public_document(text) from public;
grant execute on function public.verify_public_document(text) to anon, authenticated;

-- ── register_document_verification (legacy AVS|MTJ checksum tokens) ───────────
create or replace function public.register_document_verification(
  p_token text,
  p_doc_type text,
  p_doc_number text,
  p_record_id uuid,
  p_business_name text,
  p_party_label text default null,
  p_invoice_date date default null,
  p_total_paise bigint default null,
  p_status text default 'verified'
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_firm uuid := public.my_firm_id();
  v_hash text;
begin
  if v_firm is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  v_hash := encode(extensions.digest(trim(p_token)::bytea, 'sha256'::text), 'hex');

  insert into public.public_document_verifications (
    firm_id, doc_type, doc_number, record_id,
    public_token, token_hash,
    business_name, party_label, invoice_date, total_paise,
    legacy_checksum_token, status, access_expires_at
  ) values (
    v_firm, p_doc_type, p_doc_number, p_record_id,
    trim(p_token), v_hash,
    coalesce(nullif(trim(p_business_name), ''), 'Business'),
    p_party_label, p_invoice_date, p_total_paise,
    trim(p_token), coalesce(nullif(trim(p_status), ''), 'verified'),
    now() + interval '365 days'
  )
  on conflict (firm_id, doc_type, record_id)
  do update set
    public_token = excluded.public_token,
    token_hash = excluded.token_hash,
    legacy_checksum_token = excluded.legacy_checksum_token,
    status = excluded.status,
    updated_at = now();
end;
$$;

revoke all on function public.register_document_verification(
  text, text, text, uuid, text, text, date, bigint, text
) from public, anon;
grant execute on function public.register_document_verification(
  text, text, text, uuid, text, text, date, bigint, text
) to authenticated;

create or replace function public.revoke_document_verification_by_record(
  p_doc_type text,
  p_record_id uuid,
  p_status text default 'cancelled'
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  update public.public_document_verifications
  set status = coalesce(nullif(trim(p_status), ''), 'cancelled'),
      updated_at = now()
  where firm_id = public.my_firm_id()
    and doc_type = p_doc_type
    and record_id = p_record_id;
end;
$$;

revoke all on function public.revoke_document_verification_by_record(text, uuid, text) from public, anon;
grant execute on function public.revoke_document_verification_by_record(text, uuid, text) to authenticated;

create or replace function public.attach_verification_document_share(
  p_record_id uuid,
  p_doc_type text,
  p_document_share_token text,
  p_ttl_hours int default 24
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  update public.public_document_verifications
  set document_share_token = p_document_share_token,
      access_expires_at = now() + make_interval(hours => greatest(coalesce(p_ttl_hours, 24), 1)),
      updated_at = now()
  where firm_id = public.my_firm_id()
    and doc_type = p_doc_type
    and record_id = p_record_id;
end;
$$;

revoke all on function public.attach_verification_document_share(uuid, text, text, int) from public, anon;
grant execute on function public.attach_verification_document_share(uuid, text, text, int) to authenticated;

commit;
