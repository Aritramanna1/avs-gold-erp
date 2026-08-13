-- Internal trigger/maintenance SECURITY DEFINER functions should not be
-- callable through the Data API by ordinary signed-in users.

revoke execute on function public.notify_support_ticket_created() from authenticated;
revoke execute on function public.rls_auto_enable() from authenticated;
revoke execute on function public.touch_comm_provider_secret() from authenticated;
revoke execute on function public.trg_enforce_branch_limit() from authenticated;
revoke execute on function public.trg_enforce_storage_limit() from authenticated;
revoke execute on function public.trg_enforce_user_limit() from authenticated;
revoke execute on function public.trg_enforce_workshop_limit() from authenticated;
revoke execute on function public.evaluate_trial_expiry() from authenticated;
revoke execute on function public.reapply_all_organization_plan_entitlements(text) from authenticated;
