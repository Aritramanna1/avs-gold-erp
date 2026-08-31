-- Reduce signed-in Data API exposure for SECURITY DEFINER functions that are
-- not direct frontend RPC workflows and are not RLS helper functions.
--
-- Preserved direct RPC allowlist includes login destination, customer/karigar
-- portals, support threads/tickets, platform owner license operations,
-- document numbering/sharing, tenant license reads, and RLS helper functions.

revoke execute on function public.assert_organization_limit(text) from authenticated;
revoke execute on function public.assert_storage_limit(bigint) from authenticated;
revoke execute on function public.broadcast_platform_notifications(uuid, text, text, text, text)
  from authenticated;
revoke execute on function public.check_organization_limit(text) from authenticated;
revoke execute on function public.check_storage_limit(bigint) from authenticated;
revoke execute on function public.complete_firm_setup(uuid, text, integer, text, integer, text)
  from authenticated;
revoke execute on function public.consolidate_duplicate_branches(uuid) from authenticated;
revoke execute on function public.export_entitlement_enabled() from authenticated;
revoke execute on function public.extend_platform_trial(uuid, integer, text) from authenticated;
revoke execute on function public.generate_sequential_number(text, text) from authenticated;
revoke execute on function public.get_chatwoot_ticket_link(uuid) from authenticated;
revoke execute on function public.get_organization_plan_limits(uuid) from authenticated;
revoke execute on function public.get_organization_storage_bytes(uuid) from authenticated;
revoke execute on function public.platform_health_ping() from authenticated;
revoke execute on function public.post_gold_ledger_entries(jsonb) from authenticated;
revoke execute on function public.post_metal_conversion(jsonb) from authenticated;
revoke execute on function public.post_supplier_purchase(jsonb) from authenticated;
revoke execute on function public.provision_platform_firm(text, text, text, integer, text, integer, text, text)
  from authenticated;
revoke execute on function public.record_platform_notification(uuid, text, text, text, text, uuid)
  from authenticated;
revoke execute on function public.reverse_supplier_purchase(uuid) from authenticated;
revoke execute on function public.revoke_platform_credential(text, text) from authenticated;
revoke execute on function public.rpc_post_universal_transaction(
  uuid, text, text, text, text, text, bigint, bigint, bigint, bigint, bigint, bigint, bigint, text, timestamp with time zone, jsonb
) from authenticated;
revoke execute on function public.set_organization_feature(uuid, text, boolean, text) from authenticated;
revoke execute on function public.set_platform_firm_active(uuid, boolean, text) from authenticated;
revoke execute on function public.set_platform_setting(text, jsonb, text) from authenticated;
revoke execute on function public.set_platform_setting(text, jsonb, text, boolean) from authenticated;
revoke execute on function public.update_platform_subscription(uuid, uuid, text, text) from authenticated;
revoke execute on function public.upsert_platform_credential(text, text, text, jsonb, text)
  from authenticated;
