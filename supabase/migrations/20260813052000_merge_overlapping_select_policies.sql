-- Merge overlapping permissive SELECT policies without changing access semantics.
-- This addresses Supabase performance advisor warnings while preserving:
-- - tenant users can read their own organization usage snapshots;
-- - SaaS admins can read all organization usage snapshots;
-- - notification recipients can read their notifications;
-- - SaaS admins can read all platform notifications.

drop policy if exists organization_usage_company_read on public.organization_usage_snapshots;
drop policy if exists organization_usage_platform_admin on public.organization_usage_snapshots;

create policy organization_usage_read
on public.organization_usage_snapshots
for select
to authenticated
using (
  organization_id = public.my_firm_id()
  or public.is_saas_admin()
);

drop policy if exists platform_notifications_admin_read on public.platform_notifications;
drop policy if exists platform_notifications_recipient on public.platform_notifications;

create policy platform_notifications_read
on public.platform_notifications
for select
to authenticated
using (
  recipient_id = (select auth.uid())
  or public.is_saas_admin()
);
