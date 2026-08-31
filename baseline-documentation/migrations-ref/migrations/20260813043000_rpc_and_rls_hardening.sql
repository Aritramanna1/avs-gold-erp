-- Tighten Supabase Data API/RPC exposure for the online-only production stack.
-- SECURITY DEFINER functions must not be executable anonymously.

revoke execute on all functions in schema public from anon;
revoke execute on all functions in schema public from public;
grant execute on all functions in schema public to authenticated;

alter default privileges in schema public revoke execute on functions from anon;
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public grant execute on functions to authenticated;

drop policy if exists comm_provider_secrets_platform_admin on public.comm_provider_secrets;
create policy comm_provider_secrets_platform_admin
on public.comm_provider_secrets
for all
to authenticated
using (public.is_saas_admin())
with check (public.is_saas_admin());

drop policy if exists erp_setup_guard_platform_admin on public.erp_setup_guard;
create policy erp_setup_guard_platform_admin
on public.erp_setup_guard
for all
to authenticated
using (public.is_saas_admin())
with check (public.is_saas_admin());

drop policy if exists licenses_platform_admin on public.licenses;
create policy licenses_platform_admin
on public.licenses
for all
to authenticated
using (public.is_saas_admin())
with check (public.is_saas_admin());

drop policy if exists licenses_organization_read on public.licenses;
create policy licenses_organization_read
on public.licenses
for select
to authenticated
using (organization_id = public.my_firm_id() or public.is_saas_admin());
