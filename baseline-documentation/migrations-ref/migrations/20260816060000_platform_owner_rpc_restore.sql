-- Restore platform-owner RPC execute grants for functions that already enforce
-- public.is_saas_admin() internally. Revoked in 20260813044500 / 20260813050000
-- which broke Platform Owner UI wiring (plan entitlements, Razorpay vault, trials).

grant execute on function public.apply_plan_entitlements(uuid, uuid, text) to authenticated;
grant execute on function public.upsert_platform_credential(text, text, text, jsonb, text) to authenticated;
grant execute on function public.extend_platform_trial(uuid, integer, text) to authenticated;

-- Align trial settings key: UI saves licensing.trial_days; provisioning reads default_trial_days.
insert into public.platform_settings (key, value, updated_at)
select 'licensing.default_trial_days', value, now()
from public.platform_settings
where key = 'licensing.trial_days'
on conflict (key) do update
set value = excluded.value, updated_at = now();

-- Health dashboard: RPC enforces is_saas_admin() internally.
grant execute on function public.platform_health_ping() to authenticated;
