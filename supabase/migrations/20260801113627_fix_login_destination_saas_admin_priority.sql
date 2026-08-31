-- Reconciled from production (project dqgrrafuoxaorvyrcuuh) on 2026-08-11 — this migration was applied directly to Supabase and had no local file until now.

-- Prioritize user_roles.saas_admin over legacy user_profiles company labels (e.g. Owner).

create or replace function public.get_login_destination()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  if exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role::text in ('saas_admin', 'SaaS Admin')
  ) then
    return '/platform';
  end if;

  select role into v_role
  from public.user_profiles
  where auth_id = auth.uid() and active = true
  limit 1;

  if v_role is null then
    select role::text into v_role
    from public.user_roles
    where user_id = auth.uid()
    limit 1;
  end if;

  if v_role in ('saas_admin', 'SaaS Admin') then
    return '/platform';
  end if;

  if lower(coalesce(v_role, '')) = 'customer' then
    return '/customer-portal';
  end if;

  return '/';
end;
$$;

revoke all on function public.get_login_destination() from public;
grant execute on function public.get_login_destination() to authenticated;

update public.user_profiles
set role = 'saas_admin', updated_at = now()
where auth_id = '1fad90cc-b28e-47d9-b34d-d8785a8e25b0'
  and role in ('Owner', 'owner');
