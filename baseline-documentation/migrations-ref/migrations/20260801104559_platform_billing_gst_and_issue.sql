-- Reconciled from production (project dqgrrafuoxaorvyrcuuh) on 2026-08-11 — this migration was applied directly to Supabase and had no local file until now.

alter table public.platform_billing_documents
  add column if not exists taxable_minor bigint not null default 0,
  add column if not exists cgst_minor bigint not null default 0,
  add column if not exists sgst_minor bigint not null default 0,
  add column if not exists igst_minor bigint not null default 0,
  add column if not exists gst_minor bigint not null default 0,
  add column if not exists buyer_state_code text,
  add column if not exists seller_state_code text;

update public.platform_billing_documents
set
  taxable_minor = coalesce((data->>'taxable_minor')::bigint, (data->>'line_minor')::bigint, 0),
  cgst_minor = coalesce((data->>'cgst_minor')::bigint, 0),
  sgst_minor = coalesce((data->>'sgst_minor')::bigint, 0),
  igst_minor = coalesce((data->>'igst_minor')::bigint, 0),
  gst_minor = coalesce((data->>'gst_minor')::bigint, 0)
where taxable_minor = 0 and data <> '{}'::jsonb;

drop policy if exists platform_billing_documents_firm_read on public.platform_billing_documents;
create policy platform_billing_documents_firm_read on public.platform_billing_documents
  for select to authenticated
  using (
    firm_id = public.my_firm_id()
    and status in ('issued', 'partially_paid', 'paid', 'overdue')
  );

create table if not exists public.platform_billing_series (
  document_type text primary key,
  prefix text not null,
  last_seq bigint not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.platform_billing_series enable row level security;

drop policy if exists platform_billing_series_admin on public.platform_billing_series;
create policy platform_billing_series_admin on public.platform_billing_series
  for all to authenticated
  using (public.is_saas_admin())
  with check (public.is_saas_admin());

create or replace function public.next_platform_document_no(p_document_type text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix text;
  v_seq bigint;
  v_year text := to_char(now(), 'YYYY');
begin
  if not public.is_saas_admin() then
    raise exception 'platform admin role required' using errcode = '42501';
  end if;

  insert into public.platform_billing_series (document_type, prefix, last_seq)
  values (p_document_type, 'AVS-' || v_year, 0)
  on conflict (document_type) do nothing;

  update public.platform_billing_series
  set last_seq = last_seq + 1, updated_at = now()
  where document_type = p_document_type
  returning prefix, last_seq into v_prefix, v_seq;

  return v_prefix || '-' || lpad(v_seq::text, 5, '0');
end;
$$;

create or replace function public.issue_platform_billing_document(
  p_document_id uuid,
  p_reason text default null
)
returns public.platform_billing_documents
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doc public.platform_billing_documents;
  v_before jsonb;
begin
  if not public.is_saas_admin() then
    raise exception 'platform admin role required' using errcode = '42501';
  end if;

  select * into v_doc from public.platform_billing_documents where id = p_document_id for update;
  if not found then
    raise exception 'document not found';
  end if;
  if v_doc.status <> 'draft' then
    raise exception 'only draft documents can be issued';
  end if;

  v_before := to_jsonb(v_doc);

  update public.platform_billing_documents
  set
    status = 'issued',
    issued_at = now(),
    document_no = coalesce(nullif(trim(document_no), ''), public.next_platform_document_no(document_type)),
    taxable_minor = coalesce((data->>'taxable_minor')::bigint, taxable_minor),
    cgst_minor = coalesce((data->>'cgst_minor')::bigint, cgst_minor),
    sgst_minor = coalesce((data->>'sgst_minor')::bigint, sgst_minor),
    igst_minor = coalesce((data->>'igst_minor')::bigint, igst_minor),
    gst_minor = coalesce((data->>'gst_minor')::bigint, gst_minor)
  where id = p_document_id
  returning * into v_doc;

  perform public.record_platform_audit(
    'platform_billing.issued',
    v_doc.firm_id,
    'platform_billing_document',
    v_doc.id::text,
    p_reason,
    v_before,
    to_jsonb(v_doc)
  );

  return v_doc;
end;
$$;

revoke all on function public.next_platform_document_no(text) from public;
grant execute on function public.next_platform_document_no(text) to authenticated;

revoke all on function public.issue_platform_billing_document(uuid, text) from public;
grant execute on function public.issue_platform_billing_document(uuid, text) to authenticated;
