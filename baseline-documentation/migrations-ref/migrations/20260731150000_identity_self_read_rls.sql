-- Authenticated users must be able to resolve their own identity and role.
-- This is intentionally read-only and scoped to auth.uid(); tenant-wide
-- administration remains restricted to SaaS administrators.
drop policy if exists user_profiles_self_select on public.user_profiles;
create policy user_profiles_self_select on public.user_profiles
  for select to authenticated
  using (auth_id = auth.uid());

drop policy if exists user_roles_self_select on public.user_roles;
create policy user_roles_self_select on public.user_roles
  for select to authenticated
  using (user_id = auth.uid());
