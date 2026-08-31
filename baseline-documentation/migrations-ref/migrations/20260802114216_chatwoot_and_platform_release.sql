-- Reconciled from production (project dqgrrafuoxaorvyrcuuh) on 2026-08-11 — this migration was applied directly to Supabase and had no local file until now.

-- Chatwoot integration mappings + audited platform firm/subscription RPCs + health ping.

begin;

create table if not exists public.chatwoot_firm_mappings (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.organizations(id) on delete cascade,
  chatwoot_contact_id bigint,
  chatwoot_account_id bigint,
  sync_status text not null default 'pending'
    check (sync_status in ('pending', 'linked', 'error', 'disabled')),
  last_synced_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (firm_id)
);

create table if not exists public.chatwoot_conversation_links (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid references public.platform_support_tickets(id) on delete set null,
  firm_id uuid not null references public.organizations(id) on delete cascade,
  chatwoot_conversation_id bigint not null,
  chatwoot_inbox_id bigint,
  sync_status text not null default 'linked'
    check (sync_status in ('linked', 'synced', 'error', 'closed')),
  last_webhook_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (chatwoot_conversation_id),
  unique (ticket_id)
);

create index if not exists chatwoot_conversation_links_firm_idx
  on public.chatwoot_conversation_links (firm_id, created_at desc);

alter table public.chatwoot_firm_mappings enable row level security;
alter table public.chatwoot_conversation_links enable row level security;

create policy chatwoot_firm_mappings_admin on public.chatwoot_firm_mappings
  for all to authenticated
  using (public.is_saas_admin())
  with check (public.is_saas_admin());

create policy chatwoot_conversation_links_admin on public.chatwoot_conversation_links
  for all to authenticated
  using (public.is_saas_admin())
  with check (public.is_saas_admin());

grant select, insert, update, delete on public.chatwoot_firm_mappings to authenticated;
grant select, insert, update, delete on public.chatwoot_conversation_links to authenticated;

create or replace function public.platform_health_ping()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_started timestamptz := clock_timestamp();
  v_plans int;
begin
  if not public.is_saas_admin() then
    raise exception 'platform admin role required' using errcode = '42501';
  end if;
  select count(*)::int into v_plans from public.platform_plans where is_active;
  return jsonb_build_object(
    'ok', true,
    'latency_ms', extract(milliseconds from clock_timestamp() - v_started)::int,
    'active_plans', v_plans,
    'checked_at', now()
  );
end;
$$;

revoke all on function public.platform_health_ping() from public, anon;
grant execute on function public.platform_health_ping() to authenticated;

create or replace function public.set_platform_firm_active(
  p_firm_id uuid,
  p_is_active boolean,
  p_reason text
)
returns public.organizations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before public.organizations;
  v_after public.organizations;
begin
  if not public.is_saas_admin() then
    raise exception 'platform admin role required' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'reason is required (min 3 characters)' using errcode = '22023';
  end if;
  select * into v_before from public.organizations where id = p_firm_id;
  if v_before.id is null then
    raise exception 'organization not found' using errcode = 'P0002';
  end if;
  update public.organizations
  set is_active = p_is_active, updated_at = now()
  where id = p_firm_id
  returning * into v_after;
  perform public.record_platform_audit(
    case when p_is_active then 'firm.reactivated' else 'firm.suspended' end,
    p_firm_id,
    'organization',
    p_firm_id::text,
    trim(p_reason),
    to_jsonb(v_before),
    to_jsonb(v_after)
  );
  return v_after;
end;
$$;

revoke all on function public.set_platform_firm_active(uuid, boolean, text) from public, anon;
grant execute on function public.set_platform_firm_active(uuid, boolean, text) to authenticated;

create or replace function public.update_platform_subscription(
  p_organization_id uuid,
  p_plan_id uuid default null,
  p_status text default null,
  p_reason text default null
)
returns public.organization_subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before public.organization_subscriptions;
  v_after public.organization_subscriptions;
begin
  if not public.is_saas_admin() then
    raise exception 'platform admin role required' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'reason is required (min 3 characters)' using errcode = '22023';
  end if;
  select * into v_before from public.organization_subscriptions where organization_id = p_organization_id;
  if v_before.organization_id is null then
    raise exception 'subscription not found' using errcode = 'P0002';
  end if;
  if p_status is not null and lower(trim(p_status)) not in ('trial', 'active', 'past_due', 'suspended', 'cancelled', 'expired') then
    raise exception 'invalid subscription status' using errcode = '22023';
  end if;
  update public.organization_subscriptions
  set plan_id = coalesce(p_plan_id, plan_id), status = coalesce(lower(trim(p_status)), status), updated_at = now()
  where organization_id = p_organization_id
  returning * into v_after;
  perform public.record_platform_audit('subscription.updated', p_organization_id, 'subscription', p_organization_id::text, trim(p_reason), to_jsonb(v_before), to_jsonb(v_after));
  return v_after;
end;
$$;

revoke all on function public.update_platform_subscription(uuid, uuid, text, text) from public, anon;
grant execute on function public.update_platform_subscription(uuid, uuid, text, text) to authenticated;

create or replace function public.extend_platform_trial(p_organization_id uuid, p_days int, p_reason text)
returns public.organization_subscriptions
language plpgsql security definer set search_path = public as $$
declare v_before public.organization_subscriptions; v_after public.organization_subscriptions; v_days int := greatest(coalesce(p_days, 0), 1);
begin
  if not public.is_saas_admin() then raise exception 'platform admin role required' using errcode = '42501'; end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'reason is required (min 3 characters)' using errcode = '22023'; end if;
  select * into v_before from public.organization_subscriptions where organization_id = p_organization_id;
  if v_before.organization_id is null then raise exception 'subscription not found' using errcode = 'P0002'; end if;
  update public.organization_subscriptions set status = 'trial', trial_ends_at = coalesce(trial_ends_at, now()) + make_interval(days => v_days), updated_at = now() where organization_id = p_organization_id returning * into v_after;
  perform public.record_platform_audit('subscription.trial_extended', p_organization_id, 'subscription', p_organization_id::text, trim(p_reason), to_jsonb(v_before), to_jsonb(v_after));
  return v_after;
end; $$;

revoke all on function public.extend_platform_trial(uuid, int, text) from public, anon;
grant execute on function public.extend_platform_trial(uuid, int, text) to authenticated;

drop function if exists public.create_firm_support_ticket(text, text, text, text);

create or replace function public.create_firm_support_ticket(p_subject text, p_description text, p_category text default 'general', p_priority text default 'normal', p_module text default null, p_severity text default 'normal', p_diagnostics_consent boolean default false)
returns public.platform_support_tickets language plpgsql security definer set search_path = public as $$
declare v_profile public.user_profiles; v_ticket public.platform_support_tickets; v_conversation_id uuid; v_priority text := lower(trim(coalesce(p_priority, 'normal'))); v_severity text := lower(trim(coalesce(p_severity, 'normal'))); v_body text;
begin
  if length(trim(coalesce(p_subject, ''))) < 3 or length(trim(coalesce(p_subject, ''))) > 160 then raise exception 'subject must be between 3 and 160 characters' using errcode = '22023'; end if;
  if length(trim(coalesce(p_description, ''))) < 10 or length(trim(coalesce(p_description, ''))) > 10000 then raise exception 'description must be between 10 and 10000 characters' using errcode = '22023'; end if;
  if v_priority not in ('low', 'normal', 'high', 'urgent') then raise exception 'invalid priority' using errcode = '22023'; end if;
  if v_severity not in ('low', 'normal', 'high', 'critical') then raise exception 'invalid severity' using errcode = '22023'; end if;
  select * into v_profile from public.user_profiles where auth_id = auth.uid() and active and status = 'active' and firm_id is not null and lower(coalesce(role, '')) <> 'customer' limit 1;
  if not found then raise exception 'firm support access is not configured' using errcode = '42501'; end if;
  v_body := trim(p_description);
  if coalesce(p_diagnostics_consent, false) then v_body := v_body || E'\n\n[Diagnostics consent: user agreed to share browser/app diagnostics with AVS Support]'; end if;
  insert into public.platform_support_tickets (ticket_no, firm_id, branch_id, requester_id, category, module, subject, description, priority, severity) values ('FIRM-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)), v_profile.firm_id, v_profile.branch_id, auth.uid(), left(trim(coalesce(p_category, 'general')), 80), nullif(left(trim(coalesce(p_module, '')), 80), ''), trim(p_subject), v_body, v_priority, v_severity) returning * into v_ticket;
  select c.id into v_conversation_id from public.platform_conversations c where c.ticket_id = v_ticket.id;
  if v_conversation_id is null then insert into public.platform_conversations (firm_id, ticket_id, status) values (v_ticket.firm_id, v_ticket.id, 'open') returning id into v_conversation_id; end if;
  insert into public.platform_conversation_messages (conversation_id, sender_id, body, visibility) values (v_conversation_id, auth.uid(), v_body, 'customer');
  return v_ticket;
end; $$;

revoke all on function public.create_firm_support_ticket(text, text, text, text, text, text, boolean) from public, anon;
grant execute on function public.create_firm_support_ticket(text, text, text, text, text, text, boolean) to authenticated;

create or replace function public.get_chatwoot_ticket_link(p_ticket_id uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_link public.chatwoot_conversation_links; v_base text;
begin
  if not public.is_saas_admin() then raise exception 'platform admin role required' using errcode = '42501'; end if;
  select * into v_link from public.chatwoot_conversation_links where ticket_id = p_ticket_id;
  if v_link.id is null then return jsonb_build_object('linked', false); end if;
  select coalesce(value->>'base_url', '') into v_base from public.platform_settings where key = 'chatwoot.public_base_url';
  return jsonb_build_object('linked', true, 'conversation_id', v_link.chatwoot_conversation_id, 'inbox_id', v_link.chatwoot_inbox_id, 'sync_status', v_link.sync_status, 'deep_link', case when v_base <> '' then v_base || '/app/accounts/1/conversations/' || v_link.chatwoot_conversation_id else null end);
end; $$;

revoke all on function public.get_chatwoot_ticket_link(uuid) from public, anon;
grant execute on function public.get_chatwoot_ticket_link(uuid) to authenticated;

commit;
