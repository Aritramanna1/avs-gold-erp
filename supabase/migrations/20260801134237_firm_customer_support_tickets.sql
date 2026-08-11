-- Reconciled from production (project dqgrrafuoxaorvyrcuuh) on 2026-08-11 — this migration was applied directly to Supabase and had no local file until now.

-- Company-tenant staff can manage customer portal support tickets (CUS-* queue).

begin;

create or replace function public.is_firm_ticket_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_saas_admin()
    or exists (
      select 1
      from public.user_profiles up
      where up.auth_id = auth.uid()
        and up.active
        and up.status = 'active'
        and up.firm_id is not null
        and lower(coalesce(up.role, '')) not in ('customer', 'viewer')
    );
$$;

revoke all on function public.is_firm_ticket_staff() from public, anon;
grant execute on function public.is_firm_ticket_staff() to authenticated;

create or replace function public.list_customer_portal_support_tickets(
  p_status text default null,
  p_priority text default null
)
returns setof public.platform_support_tickets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_firm uuid := public.my_firm_id();
begin
  if v_firm is null or not public.is_firm_ticket_staff() then
    raise exception 'firm ticket access is not configured' using errcode = '42501';
  end if;

  return query
  select t.*
  from public.platform_support_tickets t
  where t.firm_id = v_firm
    and t.ticket_no like 'CUS-%'
    and (p_status is null or t.status = lower(trim(p_status)))
    and (p_priority is null or t.priority = lower(trim(p_priority)))
  order by t.created_at desc
  limit 200;
end;
$$;

create or replace function public.get_firm_customer_support_thread(p_ticket_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.is_firm_ticket_staff() then
    raise exception 'firm ticket access is not configured' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'ticket', jsonb_build_object(
      'id', t.id,
      'ticket_no', t.ticket_no,
      'subject', t.subject,
      'description', t.description,
      'status', t.status,
      'priority', t.priority,
      'category', t.category,
      'requester_id', t.requester_id,
      'assigned_to', t.assigned_to,
      'created_at', t.created_at,
      'updated_at', t.updated_at,
      'sla_due_at', t.sla_due_at
    ),
    'messages', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', m.id,
            'body', m.body,
            'created_at', m.created_at,
            'sender', case when m.sender_id = t.requester_id then 'customer' else 'support' end
          )
          order by m.created_at
        )
        from public.platform_conversation_messages m
        where m.conversation_id = c.id
          and m.visibility = 'customer'
      ),
      '[]'::jsonb
    )
  ) into v_result
  from public.platform_support_tickets t
  join public.platform_conversations c on c.ticket_id = t.id
  where t.id = p_ticket_id
    and t.firm_id = public.my_firm_id()
    and t.ticket_no like 'CUS-%';

  if v_result is null then
    raise exception 'Support ticket not found';
  end if;
  return v_result;
end;
$$;

create or replace function public.reply_firm_customer_support_ticket(
  p_ticket_id uuid,
  p_body text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticket public.platform_support_tickets;
  v_conversation public.platform_conversations;
  v_message public.platform_conversation_messages;
begin
  if not public.is_firm_ticket_staff() then
    raise exception 'firm ticket access is not configured' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_body, ''))) not between 1 and 10000 then
    raise exception 'Message must contain between 1 and 10000 characters';
  end if;

  select * into v_ticket
  from public.platform_support_tickets t
  where t.id = p_ticket_id
    and t.firm_id = public.my_firm_id()
    and t.ticket_no like 'CUS-%';

  if v_ticket.id is null then
    raise exception 'Support ticket not found';
  end if;

  select * into v_conversation
  from public.platform_conversations c
  where c.ticket_id = p_ticket_id;

  if v_conversation.status = 'closed' then
    raise exception 'Closed support tickets cannot receive replies';
  end if;

  insert into public.platform_conversation_messages (conversation_id, sender_id, body, visibility)
  values (v_conversation.id, auth.uid(), trim(p_body), 'customer')
  returning * into v_message;

  update public.platform_conversations
  set status = 'open',
      assigned_to = coalesce(v_conversation.assigned_to, auth.uid()),
      updated_at = now()
  where id = v_conversation.id;

  update public.platform_support_tickets
  set status = case when status in ('resolved', 'closed') then 'reopened' else 'in_progress' end,
      assigned_to = coalesce(assigned_to, auth.uid()),
      updated_at = now()
  where id = p_ticket_id;

  return jsonb_build_object(
    'id', v_message.id,
    'body', v_message.body,
    'created_at', v_message.created_at,
    'sender', 'support'
  );
end;
$$;

create or replace function public.transition_firm_customer_support_ticket(
  p_ticket_id uuid,
  p_status text
)
returns public.platform_support_tickets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text := lower(trim(coalesce(p_status, '')));
  v_ticket public.platform_support_tickets;
begin
  if not public.is_firm_ticket_staff() then
    raise exception 'firm ticket access is not configured' using errcode = '42501';
  end if;
  if v_status not in ('open', 'in_progress', 'waiting_customer', 'resolved', 'closed', 'reopened') then
    raise exception 'invalid ticket status' using errcode = '22023';
  end if;

  update public.platform_support_tickets t
  set status = v_status,
      resolved_at = case when v_status = 'resolved' then now() else t.resolved_at end,
      closed_at = case when v_status = 'closed' then now() else t.closed_at end,
      updated_at = now()
  where t.id = p_ticket_id
    and t.firm_id = public.my_firm_id()
    and t.ticket_no like 'CUS-%'
  returning * into v_ticket;

  if v_ticket.id is null then
    raise exception 'Support ticket not found';
  end if;

  update public.platform_conversations c
  set status = case when v_status = 'closed' then 'closed' else c.status end,
      updated_at = now()
  where c.ticket_id = p_ticket_id;

  return v_ticket;
end;
$$;

revoke all on function public.list_customer_portal_support_tickets(text, text) from public, anon;
revoke all on function public.get_firm_customer_support_thread(uuid) from public, anon;
revoke all on function public.reply_firm_customer_support_ticket(uuid, text) from public, anon;
revoke all on function public.transition_firm_customer_support_ticket(uuid, text) from public, anon;

grant execute on function public.list_customer_portal_support_tickets(text, text) to authenticated;
grant execute on function public.get_firm_customer_support_thread(uuid) to authenticated;
grant execute on function public.reply_firm_customer_support_ticket(uuid, text) to authenticated;
grant execute on function public.transition_firm_customer_support_ticket(uuid, text) to authenticated;

commit;
