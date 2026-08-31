-- Fix provision_public_trial overload ambiguity (PGRST203) and enforce disabled stub.
begin;

do $$
declare
  r record;
begin
  for r in
    select pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'provision_public_trial'
  loop
    execute format('drop function if exists public.provision_public_trial(%s)', r.args);
  end loop;
end $$;

create or replace function public.provision_public_trial(
  p_firm_name text,
  p_firm_slug text,
  p_owner_full_name text,
  p_owner_phone text default '',
  p_owner_email text default '',
  p_product_id text default 'ORNEXA',
  p_branch_name text default 'Main Branch'
)
returns table (
  organization_id uuid,
  branch_id text,
  subscription_id uuid,
  lead_id uuid,
  trial_ends_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  raise exception 'Public self-signup is disabled. Request access from AVS or use an authorized invitation.'
    using errcode = '42501';
end;
$$;

revoke all on function public.provision_public_trial(text, text, text, text, text, text, text)
  from public, anon, authenticated, service_role;

commit;
