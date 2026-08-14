-- Extend public.get_customer_portal() RPC to return gold balance, gold entries, and cash ledger.
begin;

create or replace function public.get_customer_portal()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_profile public.user_profiles;
  v_person public.people;
  v_firm uuid;
  v_result jsonb;
  v_gold_balance numeric;
  v_gold_entries jsonb;
  v_cash_ledger jsonb;
begin
  select * into v_profile
  from public.user_profiles
  where auth_id = auth.uid()
    and active
    and status = 'active'
    and lower(coalesce(role, '')) = 'customer'
  limit 1;

  if not found or v_profile.customer_person_id is null or v_profile.firm_id is null then
    raise exception 'customer portal access is not configured' using errcode = '42501';
  end if;

  v_firm := v_profile.firm_id;
  select * into v_person
  from public.people
  where id = v_profile.customer_person_id
    and firm_id = v_firm
    and type in ('customer', 'Customer')
    and active;

  if not found then
    raise exception 'customer profile was not found' using errcode = '42501';
  end if;

  -- Compute gold balance
  select coalesce(sum((g.data->'deltas'->>'customer')::numeric), 0) into v_gold_balance
  from public.gold_ledger g
  where g.firm_id = v_firm
    and g.data->>'customerId' = v_person.id;

  -- Get gold ledger entries
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', g.id,
    'ts', g.ts,
    'type', g.data->>'type',
    'netFineMg', (g.data->>'netFineMg')::numeric,
    'grossMg', (g.data->>'grossMg')::numeric,
    'purity', (g.data->>'purity')::numeric,
    'notes', g.data->>'notes',
    'reference', g.data->>'reference'
  ) order by g.ts desc), '[]'::jsonb) into v_gold_entries
  from public.gold_ledger g
  where g.firm_id = v_firm
    and g.data->>'customerId' = v_person.id;

  -- Get cash ledger entries
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', cl.id,
    'ts', cl.ts,
    'kind', cl.kind,
    'debit_paise', cl.debit_paise,
    'credit_paise', cl.credit_paise,
    'description', cl.description,
    'ref', cl.ref
  ) order by cl.ts desc), '[]'::jsonb) into v_cash_ledger
  from public.customer_ledger cl
  where cl.firm_id = v_firm
    and cl.customer_id = v_person.id;

  select jsonb_build_object(
    'profile', jsonb_build_object(
      'id', v_person.id,
      'full_name', v_person.full_name,
      'phone', v_person.phone,
      'whatsapp', v_person.whatsapp,
      'email', v_person.email,
      'village_city', v_person.village_city,
      'current_address', v_person.current_address
    ),
    'gold_balance_mg', v_gold_balance,
    'gold_entries', v_gold_entries,
    'cash_ledger', v_cash_ledger,
    'invoices', coalesce((select jsonb_agg(jsonb_build_object(
        'id', i.id, 'invoice_no', i.invoice_no, 'status', i.status,
        'gst', i.gst, 'subtotal_paise', i.subtotal_paise,
        'gst_paise', i.gst_paise, 'grand_total_paise', i.grand_total_paise,
        'paid_paise', i.paid_paise, 'balance_paise', i.balance_paise,
        'created_at', i.created_at
      ) order by i.created_at desc)
      from public.invoices i
      where i.firm_id = v_firm and i.customer_id = v_person.id), '[]'::jsonb),
    'orders', coalesce((select jsonb_agg(jsonb_build_object(
        'id', o.id, 'order_no', o.order_no, 'type', o.type,
        'status', o.status, 'expected_delivery', o.expected_delivery,
        'priority', o.priority, 'created_at', o.created_at
      ) order by o.created_at desc)
      from public.orders o
      where o.firm_id = v_firm and o.customer_id = v_person.id), '[]'::jsonb),
    'repairs', coalesce((select jsonb_agg(jsonb_build_object(
        'id', r.id, 'repair_no', r.repair_no, 'kind', r.kind,
        'status', r.status, 'estimated_charge_paise', r.estimated_charge_paise,
        'advance_paise', r.advance_paise, 'received_gross_mg', r.received_gross_mg,
        'created_at', r.created_at
      ) order by r.created_at desc)
      from public.repairs r
      where r.firm_id = v_firm and r.customer_id = v_person.id), '[]'::jsonb),
    'support_tickets', coalesce((select jsonb_agg(jsonb_build_object(
        'id', t.id, 'ticket_no', t.ticket_no, 'category', t.category,
        'subject', t.subject, 'description', t.description,
        'severity', t.severity, 'priority', t.priority, 'status', t.status,
        'resolution', case when t.status in ('resolved', 'closed') then t.resolution else null end,
        'created_at', t.created_at, 'updated_at', t.updated_at
      ) order by t.created_at desc)
      from public.platform_support_tickets t
      where t.firm_id = v_firm and t.requester_id = auth.uid()), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

commit;
