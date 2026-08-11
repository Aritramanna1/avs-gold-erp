-- Reconciled from production (project dqgrrafuoxaorvyrcuuh) on 2026-08-11 — this migration was applied directly to Supabase and had no local file until now.

begin;
create table if not exists public.licenses (
 id uuid primary key default gen_random_uuid(), license_id text unique not null, customer_name text not null, company_name text not null,
 status text not null default 'active' check (status in ('active','suspended','revoked','expired')), edition text not null, seats integer not null default 1 check (seats > 0),
 expiry_date timestamptz, payload text not null default '{}', signature text not null default 'managed-server-license',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.licenses enable row level security;
revoke all on public.licenses from anon, authenticated;
drop policy if exists "Allow authenticated full access to licenses" on public.licenses;
create or replace function public.validate_license(p_license_key text,p_device_id text,p_deployment_mode text)
returns json language plpgsql security definer set search_path = public
as $func$ declare v_license public.licenses; begin
 select * into v_license from public.licenses where license_id=p_license_key;
 if not found then return json_build_object('valid',false,'message','Invalid license key.','customerStatus','invalid'); end if;
 return json_build_object('valid',v_license.status='active' and (v_license.expiry_date is null or v_license.expiry_date>now()),'edition',v_license.edition,'expiry',v_license.expiry_date,'maximumDevices',v_license.seats,'customerStatus',v_license.status,'entitlement',v_license.payload,'signature',v_license.signature,'message',case when v_license.status!='active' then 'License is '||v_license.status when v_license.expiry_date is not null and v_license.expiry_date<=now() then 'License has expired' else 'License is valid' end);
end $func$;
revoke all on function public.validate_license(text,text,text) from public;
grant execute on function public.validate_license(text,text,text) to anon, authenticated, service_role;
commit;
