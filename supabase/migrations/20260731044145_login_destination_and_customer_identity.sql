-- Reconciled from production (project dqgrrafuoxaorvyrcuuh) on 2026-08-11 — this migration was applied directly to Supabase and had no local file until now.

alter table public.user_profiles
  add column if not exists customer_person_id text references public.people(id) on delete set null;

create index if not exists idx_user_profiles_customer_person
  on public.user_profiles(customer_person_id)
  where customer_person_id is not null;

create or replace function public.get_login_destination()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_profile public.user_profiles;
  v_business_type text;
begin
  select * into v_profile
  from public.user_profiles
  where auth_id = auth.uid()
    and active
    and status = 'active'
  limit 1;

  if not found then
    return '/';
  end if;

  if lower(coalesce(v_profile.role,'')) = 'customer'
     or v_profile.customer_person_id is not null
     or coalesce((v_profile.data->>'customer_portal')::boolean, false) then
    return '/customer-portal';
  end if;

  select lower(coalesce(o.data->>'business_type', o.onboarding->>'business_type', ''))
    into v_business_type
  from public.organizations o
  where o.id = v_profile.firm_id;

  if v_business_type in ('retail','retail_counter','retail_jewellery') then
    return '/retail';
  elsif v_business_type in ('wholesale','wholesale_jewellery') then
    return '/wholesale';
  end if;

  return '/';
end;
$$;

revoke all on function public.get_login_destination() from public;
grant execute on function public.get_login_destination() to authenticated;
