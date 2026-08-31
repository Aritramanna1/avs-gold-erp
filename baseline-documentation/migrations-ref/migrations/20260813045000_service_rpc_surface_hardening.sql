-- Keep service/admin-only SECURITY DEFINER functions out of the signed-in
-- Data API surface. Edge Functions and nested database calls can still execute
-- these with their owning/service privileges.

revoke execute on function public.onboard_tenant(
  uuid, text, text, text, text, text, text, text, text, integer
) from authenticated;

revoke execute on function public.next_platform_document_no(text) from authenticated;
revoke execute on function public.issue_platform_billing_document(uuid, text) from authenticated;
revoke execute on function public.record_platform_billing_payment(uuid, bigint, text, text) from authenticated;
revoke execute on function public.validate_license(text, text, text) from authenticated;
