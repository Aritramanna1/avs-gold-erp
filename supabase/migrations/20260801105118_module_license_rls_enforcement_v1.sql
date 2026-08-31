-- Reconciled from production (project dqgrrafuoxaorvyrcuuh) on 2026-08-11 — this migration was applied directly to Supabase and had no local file until now.

create or replace function public.organization_feature_enabled(p_feature_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select of.enabled
      from public.organization_features of
      where of.organization_id = public.my_firm_id()
        and of.feature_key = p_feature_key
    ),
    true
  );
$$;

create or replace function public.tenant_module_write_allowed(p_feature_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_saas_admin()
    or public.organization_feature_enabled(p_feature_key);
$$;

insert into public.organization_features (organization_id, feature_key, enabled, source)
select o.id, f.key, true, 'system'
from public.organizations o
cross join (
  values ('billing'),('manufacturing'),('job_work'),('gst'),('bullion'),('melt_account'),
  ('crm_communications'),('inventory'),('repairs'),('orders'),('attendance'),('payroll'),
  ('hr'),('loyalty_program'),('barcode'),('hardware_integration'),('whatsapp'),('email'),
  ('sms'),('customer_portal'),('supplier_management'),('reports'),('analytics'),('multi_branch')
) as f(key)
on conflict (organization_id, feature_key) do nothing;

revoke all on function public.tenant_module_write_allowed(text) from public;
grant execute on function public.tenant_module_write_allowed(text) to authenticated;
