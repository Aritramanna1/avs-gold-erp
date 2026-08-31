-- Support infrastructure hardening.
-- Additive: keeps existing tickets/messages and only replaces RPC behavior/policies.

create or replace function public.create_staff_support_ticket(
  p_subject text,
  p_description text,
  p_category text default 'general',
  p_priority text default 'normal'
)
returns public.platform_support_tickets
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_profile public.user_profiles;
  v_ticket public.platform_support_tickets;
  v_conversation_id uuid;
  v_priority text := lower(trim(coalesce(p_priority, 'normal')));
  v_subject text := trim(coalesce(p_subject, ''));
  v_description text := trim(coalesce(p_description, ''));
begin
  if length(v_subject) < 3 or length(v_subject) > 160 then
    raise exception 'subject must be between 3 and 160 characters' using errcode = '22023';
  end if;
  if length(v_description) < 10 or length(v_description) > 10000 then
    raise exception 'description must be between 10 and 10000 characters' using errcode = '22023';
  end if;
  if v_priority not in ('low', 'normal', 'high', 'urgent') then
    raise exception 'invalid priority' using errcode = '22023';
  end if;

  select * into v_profile
  from public.user_profiles
  where auth_id = auth.uid()
    and active
    and status = 'active'
    and firm_id is not null
  limit 1;
  if not found then
    raise exception 'No active firm profile for this account' using errcode = '42501';
  end if;

  insert into public.platform_support_tickets
    (ticket_no, firm_id, branch_id, requester_id, category, subject, description, priority, severity, status)
  values
    (
      'STF-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') || '-' ||
        upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)),
      v_profile.firm_id,
      v_profile.branch_id,
      auth.uid(),
      left(trim(coalesce(p_category, 'general')), 80),
      v_subject,
      v_description,
      v_priority,
      case when v_priority = 'urgent' then 'critical' when v_priority = 'high' then 'high' else 'normal' end,
      'open'
    )
  returning * into v_ticket;

  insert into public.platform_conversations (firm_id, ticket_id, status)
  values (v_ticket.firm_id, v_ticket.id, 'open')
  returning id into v_conversation_id;

  insert into public.platform_conversation_messages (conversation_id, sender_id, body, visibility)
  values (v_conversation_id, auth.uid(), v_description, 'customer');

  return v_ticket;
end;
$$;

revoke all on function public.create_staff_support_ticket(text, text, text, text) from public, anon;
grant execute on function public.create_staff_support_ticket(text, text, text, text) to authenticated;

drop policy if exists platform_conversations_customer_read on public.platform_conversations;
create policy platform_conversations_customer_read on public.platform_conversations
for select to authenticated
using (
  exists (
    select 1
    from public.platform_support_tickets t
    where t.id = ticket_id
      and t.firm_id = public.my_firm_id()
      and t.requester_id = auth.uid()
  )
);

drop policy if exists platform_messages_customer_read on public.platform_conversation_messages;
create policy platform_messages_customer_read on public.platform_conversation_messages
for select to authenticated
using (
  visibility = 'customer'
  and exists (
    select 1
    from public.platform_conversations c
    join public.platform_support_tickets t on t.id = c.ticket_id
    where c.id = conversation_id
      and t.firm_id = public.my_firm_id()
      and t.requester_id = auth.uid()
  )
);

drop policy if exists platform_messages_customer_insert on public.platform_conversation_messages;
create policy platform_messages_customer_insert on public.platform_conversation_messages
for insert to authenticated
with check (
  sender_id = auth.uid()
  and visibility = 'customer'
  and exists (
    select 1
    from public.platform_conversations c
    join public.platform_support_tickets t on t.id = c.ticket_id
    where c.id = conversation_id
      and t.firm_id = public.my_firm_id()
      and t.requester_id = auth.uid()
  )
);

do $$
begin
  begin
    alter publication supabase_realtime add table public.platform_conversation_messages;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end $$;
