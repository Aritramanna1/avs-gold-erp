-- Disable public self-serve trial signup / tenant creation.
-- Authorized paths only: invite-accept edge, onboard_tenant (service/admin), platform owner tools.

begin;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- ── Block public trial provisioning ───────────────────────────────────────────
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
  from public, anon, authenticated;

-- Platform owner tools may still inspect trial config; public UI must not advertise trials.
create or replace function public.get_platform_trial_days()
returns integer
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select 0;
$$;

revoke all on function public.get_platform_trial_days() from public, anon;
grant execute on function public.get_platform_trial_days() to authenticated, service_role;

-- ── Invitation accept abuse protection (validate / accept / OAuth accept) ─────
create or replace function public.check_invite_accept_rate_limit(
  p_email text,
  p_action text default 'validate'
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_key text;
begin
  if p_email is null or length(trim(p_email)) < 3 then
    return false;
  end if;
  v_key := 'invite_accept:' || left(
    encode(extensions.digest(lower(trim(p_email))::bytea, 'sha256'::text), 'hex'),
    16
  ) || ':' || coalesce(nullif(trim(p_action), ''), 'validate');
  return public.check_api_rate_limit(v_key, 25, 60);
end;
$$;

revoke all on function public.check_invite_accept_rate_limit(text, text) from public, anon;
grant execute on function public.check_invite_accept_rate_limit(text, text) to service_role;

commit;
