-- Reconciled from production (project dqgrrafuoxaorvyrcuuh) on 2026-08-11 — this migration was applied directly to Supabase and had no local file until now.

-- Multi-tenant app_settings: global singleton ids (firm, comm_configs) conflicted with
-- firm-scoped RLS after 20260730160000. Staff tenants could not upsert settings → 403
-- toast storm ("could not complete a database operation") on every persist/click.

begin;

-- Firm settings: one row per tenant keyed by organization id (text).
update public.app_settings
set id = firm_id::text
where id = 'firm'
  and firm_id is not null
  and id <> firm_id::text;

insert into public.app_settings (id, firm_id, scope, data)
select o.id::text, o.id, 'firm', '{}'::jsonb
from public.organizations o
where not exists (
  select 1 from public.app_settings a
  where a.firm_id = o.id and a.scope = 'firm'
);

-- Communication provider configs: clone legacy global row per tenant when missing.
insert into public.app_settings (id, firm_id, scope, data)
select o.id::text || ':comm_configs', o.id, 'firm', g.data
from public.organizations o
join public.app_settings g on g.id = 'comm_configs' and g.firm_id is null
where not exists (
  select 1 from public.app_settings a where a.id = o.id::text || ':comm_configs'
);

-- Business rules blob (if present): same per-tenant pattern.
insert into public.app_settings (id, firm_id, scope, data)
select o.id::text || ':business_rules', o.id, 'firm', g.data
from public.organizations o
join public.app_settings g on g.id = 'business_rules' and g.firm_id is null
where not exists (
  select 1 from public.app_settings a where a.id = o.id::text || ':business_rules'
);

-- Legacy global rows are superseded; tenants now have firm-scoped copies.
delete from public.app_settings
where firm_id is null
  and id in ('comm_configs', 'business_rules');

commit;
