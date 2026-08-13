-- Tighten direct REST/RPC exposure for internal helper functions.
--
-- These functions are intentionally SECURITY DEFINER, but they are helper
-- routines for platform/server-side workflows rather than frontend RPC
-- endpoints. Keep service_role/postgres execution available while removing
-- direct signed-in Data API execution.

revoke execute on function public.apply_plan_entitlements(uuid, uuid, text) from authenticated;
grant execute on function public.apply_plan_entitlements(uuid, uuid, text) to service_role;

revoke execute on function public.require_organization_feature(text) from authenticated;
grant execute on function public.require_organization_feature(text) to service_role;
