-- Reconciled from production (project dqgrrafuoxaorvyrcuuh) on 2026-08-11 — this migration was applied directly to Supabase and had no local file until now.

create or replace function public.get_my_tenant_license_key()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select l.license_id
  from public.user_profiles up
  join public.organizations o on o.id = up.firm_id
  join public.licenses l on lower(l.company_name) = lower(o.name)
  where up.auth_id = auth.uid()
    and up.active = true
    and l.status = 'active'
    and (l.expiry_date is null or l.expiry_date > now())
  order by l.updated_at desc
  limit 1
$$;

revoke all on function public.get_my_tenant_license_key() from public;
grant execute on function public.get_my_tenant_license_key() to authenticated;
