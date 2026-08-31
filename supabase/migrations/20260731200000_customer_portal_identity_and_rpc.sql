-- Authenticated customer portal foundation.
-- A customer account must be explicitly linked to exactly one people row;
-- portal reads are returned by a SECURITY DEFINER function with tenant checks.
begin;

alter table public.user_profiles
  add column if not exists customer_person_id text references public.people(id) on delete set null;

create index if not exists idx_user_profiles_customer_person
  on public.user_profiles(customer_person_id)
  where customer_person_id is not null;

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

revoke all on function public.get_customer_portal() from public, anon;
grant execute on function public.get_customer_portal() to authenticated;

create or replace function public.create_customer_support_ticket(
  p_subject text,
  p_description text,
  p_category text default 'general',
  p_priority text default 'normal'
)
returns public.platform_support_tickets
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_profile public.user_profiles;
  v_ticket public.platform_support_tickets;
  v_priority text := lower(trim(coalesce(p_priority, 'normal')));
begin
  if length(trim(coalesce(p_subject, ''))) < 3 or length(trim(coalesce(p_subject, ''))) > 160 then
    raise exception 'subject must be between 3 and 160 characters' using errcode = '22023';
  end if;
  if length(trim(coalesce(p_description, ''))) < 10 or length(trim(coalesce(p_description, ''))) > 10000 then
    raise exception 'description must be between 10 and 10000 characters' using errcode = '22023';
  end if;
  if v_priority not in ('low', 'normal', 'high', 'urgent') then
    raise exception 'invalid priority' using errcode = '22023';
  end if;

  select * into v_profile from public.user_profiles
  where auth_id = auth.uid() and active and status = 'active'
    and lower(coalesce(role, '')) = 'customer' and firm_id is not null
  limit 1;
  if not found then
    raise exception 'customer portal access is not configured' using errcode = '42501';
  end if;

  insert into public.platform_support_tickets
    (ticket_no, firm_id, branch_id, requester_id, category, subject, description, priority)
  values
    ('CUS-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)),
     v_profile.firm_id, v_profile.branch_id, auth.uid(),
     left(trim(coalesce(p_category, 'general')), 80), trim(p_subject), trim(p_description), v_priority)
  returning * into v_ticket;

  return v_ticket;
end;
$$;

revoke all on function public.create_customer_support_ticket(text, text, text, text) from public, anon;
grant execute on function public.create_customer_support_ticket(text, text, text, text) to authenticated;

commit;
