-- Create public.get_supplier_portal() RPC for B2B supplier/vendor portal.
begin;

create or replace function public.get_supplier_portal()
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
    and lower(coalesce(role, '')) in ('supplier', 'vendor')
  limit 1;

  if not found or v_profile.customer_person_id is null or v_profile.firm_id is null then
    raise exception 'supplier portal access is not configured' using errcode = '42501';
  end if;

  v_firm := v_profile.firm_id;
  select * into v_person
  from public.people
  where id = v_profile.customer_person_id
    and firm_id = v_firm
    and type in ('vendor', 'outside_worker', 'vendor_supplier')
    and active;

  if not found then
    raise exception 'supplier profile was not found' using errcode = '42501';
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
    'purchases', coalesce((select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'purchase_no', p.purchase_no,
        'invoice_no', p.invoice_no,
        'invoice_date', p.invoice_date,
        'total_paise', p.total_paise,
        'paid_paise', p.paid_paise,
        'due_paise', p.due_paise,
        'fine_mg', p.fine_mg,
        'gold_paid_fine_mg', p.gold_paid_fine_mg,
        'gross_mg', p.gross_mg,
        'created_at', p.created_at
      ) order by p.created_at desc)
      from public.supplier_purchases p
      where p.firm_id = v_firm and p.supplier_id = v_person.id), '[]'::jsonb),
    'outside_work', coalesce((select jsonb_agg(jsonb_build_object(
        'id', ow.id,
        'order_id', ow.order_id,
        'created_at', ow.created_at,
        'data', ow.data
      ) order by ow.created_at desc)
      from public.outside_work_transactions ow
      where ow.firm_id = v_firm and ow.worker_id = v_person.id), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_supplier_portal() from public, anon;
grant execute on function public.get_supplier_portal() to authenticated;

commit;
