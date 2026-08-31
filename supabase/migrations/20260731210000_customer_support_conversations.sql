-- Customer-visible support threads. Messages are always tenant- and requester-scoped.
alter table public.platform_conversation_messages
  drop constraint if exists platform_conversation_messages_body_check;
alter table public.platform_conversation_messages
  add constraint platform_conversation_messages_body_check
  check (length(trim(body)) between 1 and 10000);

create or replace function public.ensure_support_ticket_conversation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.platform_conversations (firm_id, ticket_id, status)
  values (new.firm_id, new.id, 'open')
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists platform_support_ticket_conversation on public.platform_support_tickets;
create trigger platform_support_ticket_conversation
after insert on public.platform_support_tickets
for each row execute function public.ensure_support_ticket_conversation();

create or replace function public.get_customer_support_thread(p_ticket_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'ticket', jsonb_build_object(
      'id', t.id, 'ticket_no', t.ticket_no, 'subject', t.subject,
      'status', t.status, 'priority', t.priority, 'created_at', t.created_at,
      'updated_at', t.updated_at
    ),
    'messages', coalesce((select jsonb_agg(jsonb_build_object(
      'id', m.id, 'body', m.body, 'status', m.status, 'created_at', m.created_at,
      'sender', case when m.sender_id = auth.uid() then 'customer' else 'support' end
    ) order by m.created_at)
      from public.platform_conversation_messages m
      where m.conversation_id = c.id and m.visibility = 'customer'), '[]'::jsonb)
  ) into v_result
  from public.platform_support_tickets t
  join public.platform_conversations c on c.ticket_id = t.id
  where t.id = p_ticket_id
    and t.firm_id = public.my_firm_id()
    and t.requester_id = auth.uid();

  if v_result is null then
    raise exception 'Support ticket not found';
  end if;
  return v_result;
end;
$$;

create or replace function public.reply_customer_support_ticket(
  p_ticket_id uuid,
  p_body text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conversation public.platform_conversations;
  v_message public.platform_conversation_messages;
begin
  if length(trim(coalesce(p_body, ''))) not between 1 and 10000 then
    raise exception 'Message must contain between 1 and 10000 characters';
  end if;

  select c.* into v_conversation
  from public.platform_conversations c
  join public.platform_support_tickets t on t.id = c.ticket_id
  where c.ticket_id = p_ticket_id
    and t.firm_id = public.my_firm_id()
    and t.requester_id = auth.uid();

  if v_conversation.id is null then
    raise exception 'Support ticket not found';
  end if;
  if v_conversation.status = 'closed' then
    raise exception 'Closed support tickets cannot receive replies';
  end if;

  insert into public.platform_conversation_messages (conversation_id, sender_id, body, visibility)
  values (v_conversation.id, auth.uid(), trim(p_body), 'customer')
  returning * into v_message;

  update public.platform_conversations
  set status = 'waiting', updated_at = now()
  where id = v_conversation.id;
  update public.platform_support_tickets
  set status = case when status in ('resolved', 'closed') then 'reopened' else status end,
      updated_at = now()
  where id = p_ticket_id;

  return jsonb_build_object(
    'id', v_message.id, 'body', v_message.body,
    'status', v_message.status, 'created_at', v_message.created_at, 'sender', 'customer'
  );
end;
$$;

revoke all on function public.get_customer_support_thread(uuid) from public, anon;
revoke all on function public.reply_customer_support_ticket(uuid, text) from public, anon;
grant execute on function public.get_customer_support_thread(uuid) to authenticated;
grant execute on function public.reply_customer_support_ticket(uuid, text) to authenticated;

create policy platform_conversations_customer_read on public.platform_conversations
for select to authenticated
using (
  exists (
    select 1 from public.platform_support_tickets t
    where t.id = ticket_id and t.firm_id = public.my_firm_id() and t.requester_id = auth.uid()
  )
);

create policy platform_messages_customer_read on public.platform_conversation_messages
for select to authenticated
using (
  visibility = 'customer' and exists (
    select 1 from public.platform_conversations c
    join public.platform_support_tickets t on t.id = c.ticket_id
    where c.id = conversation_id and t.firm_id = public.my_firm_id() and t.requester_id = auth.uid()
  )
);

create policy platform_messages_customer_insert on public.platform_conversation_messages
for insert to authenticated
with check (
  sender_id = auth.uid() and visibility = 'customer' and exists (
    select 1 from public.platform_conversations c
    join public.platform_support_tickets t on t.id = c.ticket_id
    where c.id = conversation_id and t.firm_id = public.my_firm_id() and t.requester_id = auth.uid()
  )
);
