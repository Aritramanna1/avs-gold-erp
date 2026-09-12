-- BUG-009: Revoke public and anon execution on internal maintenance & trigger SECURITY DEFINER functions.
-- Hardens PostgREST RPC boundary so schema helper functions cannot be executed anonymously.

revoke execute on function public.rls_auto_enable() from anon, public;
revoke execute on function public.notify_support_ticket_created() from anon, public;
revoke execute on function public.touch_comm_provider_secret() from anon, public;
revoke execute on function public.trg_enforce_branch_limit() from anon, public;
revoke execute on function public.trg_enforce_storage_limit() from anon, public;
revoke execute on function public.trg_enforce_user_limit() from anon, public;
revoke execute on function public.trg_enforce_workshop_limit() from anon, public;
revoke execute on function public.evaluate_trial_expiry() from anon, public;
revoke execute on function public.reapply_all_organization_plan_entitlements(text) from anon, public;
