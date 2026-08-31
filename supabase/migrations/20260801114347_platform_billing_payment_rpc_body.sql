-- Reconciled from production (project dqgrrafuoxaorvyrcuuh) on 2026-08-11 — this migration was applied directly to Supabase and had no local file until now.

create or replace function public.record_platform_billing_payment(
  p_document_id uuid,
  p_amount_minor bigint,
  p_method text,
  p_reference text default null
)
returns public.platform_billing_documents
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doc public.platform_billing_documents;
  v_before jsonb;
  v_after jsonb;
begin
  if not public.is_saas_admin() then
    raise exception 'platform admin role required' using errcode = '42501';
  end if;

  if p_amount_minor is null or p_amount_minor <= 0 then
    raise exception 'payment amount must be positive' using errcode = '22023';
  end if;

  if p_method not in ('cash', 'bank', 'upi', 'card', 'other') then
    raise exception 'invalid payment method' using errcode = '22023';
  end if;

  select * into v_doc
  from public.platform_billing_documents
  where id = p_document_id
  for update;

  if not found then
    raise exception 'billing document not found' using errcode = 'P0002';
  end if;

  v_before := to_jsonb(v_doc);

  insert into public.platform_billing_payments (
    billing_document_id,
    firm_id,
    amount_minor,
    method,
    reference,
    created_by
  )
  values (
    v_doc.id,
    v_doc.firm_id,
    p_amount_minor,
    p_method,
    nullif(trim(p_reference), ''),
    auth.uid()
  );

  update public.platform_billing_documents
  set paid_minor = coalesce(paid_minor, 0) + p_amount_minor,
      status = case
        when coalesce(paid_minor, 0) + p_amount_minor >= amount_minor then 'paid'
        when status = 'draft' then status
        else 'partially_paid'
      end,
      updated_at = now()
  where id = v_doc.id
  returning * into v_doc;

  v_after := to_jsonb(v_doc);

  perform public.record_platform_audit(
    'platform_billing.payment_recorded',
    v_doc.firm_id,
    'platform_billing_document',
    v_doc.id::text,
    coalesce(p_reference, p_method),
    v_before,
    v_after
  );

  return v_doc;
end;
$$;

revoke all on function public.record_platform_billing_payment(uuid, bigint, text, text) from public;
grant execute on function public.record_platform_billing_payment(uuid, bigint, text, text) to authenticated;
