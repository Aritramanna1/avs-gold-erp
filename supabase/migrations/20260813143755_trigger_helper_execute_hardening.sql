-- Trigger helper functions are invoked by Postgres triggers only. They must
-- not be callable through PostgREST RPC by anonymous or signed-in browser
-- clients, especially because they are SECURITY DEFINER helpers.

REVOKE EXECUTE ON FUNCTION public.set_firm_id_default() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_firm_id_default() FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_firm_id_default() FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.null_invalid_branch_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.null_invalid_branch_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.null_invalid_branch_id() FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.null_invalid_default_branch_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.null_invalid_default_branch_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.null_invalid_default_branch_id() FROM authenticated;

GRANT EXECUTE ON FUNCTION public.set_firm_id_default() TO service_role;
GRANT EXECUTE ON FUNCTION public.null_invalid_branch_id() TO service_role;
GRANT EXECUTE ON FUNCTION public.null_invalid_default_branch_id() TO service_role;
