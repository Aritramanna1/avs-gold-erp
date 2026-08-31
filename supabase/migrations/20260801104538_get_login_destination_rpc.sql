-- Reconciled from production (project dqgrrafuoxaorvyrcuuh) on 2026-08-11 — this migration was applied directly to Supabase and had no local file until now.

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
  select role into v_role
  from public.user_profiles
  where auth_id = auth.uid() and active = true
  limit 1;

  if v_role is null then
    select role into v_role
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
