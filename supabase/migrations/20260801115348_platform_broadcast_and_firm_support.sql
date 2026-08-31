-- Reconciled from production (project dqgrrafuoxaorvyrcuuh) on 2026-08-11 — this migration was applied directly to Supabase and had no local file until now.

-- Platform broadcast notifications + firm staff support + admin ticket replies.

create or replace function public.broadcast_platform_notifications(
  p_firm_id uuid,
  p_kind text,
  p_title text,
  p_body text default null,
  p_href text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  if not public.is_saas_admin() then
    raise exception 'platform admin role required' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_title, ''))) < 2 then
    raise exception 'title is required' using errcode = '22023';
  end if;

  insert into public.platform_notifications(recipient_id, firm_id, kind, title, body, href)
  select up.auth_id, p_firm_id, trim(p_kind), trim(p_title), p_body, p_href
  from public.user_profiles up
  where up.active
    and up.status = 'active'
    and up.auth_id is not null
    and (p_firm_id is null or up.firm_id = p_firm_id);

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.broadcast_platform_notifications(uuid, text, text, text, text) from public, anon;
grant execute on function public.broadcast_platform_notifications(uuid, text, text, text, text) to authenticated, service_role;

create or replace function public.create_firm_support_ticket(
  p_subject text,
  p_description text,
  p_category text default 'general',
  p_priority text default 'normal'
)
returns public.platform_support_tickets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.user_profiles;
  v_ticket public.platform_support_tickets;
  v_priority text := lower(trim(coalesce(p_priority, 'normal')));
begin
  if length(trim(coalesce(p_subject, ''))) < 3 or length(trim(coalesce(p_subject, ''))) > 160 then
    raise exception 'subject must be between 3 and 160 characters' using errcode = '22023';
  end if;
  if length(trim(coalesce(p_description, ''))) < 10 or length(trim(coalesce(p_description, ''))) > 10000 then
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
    and lower(coalesce(role, '')) <> 'customer'
  limit 1;

  if not found then
    raise exception 'firm support access is not configured' using errcode = '42501';
  end if;

  insert into public.platform_support_tickets
    (ticket_no, firm_id, branch_id, requester_id, category, subject, description, priority)
  values
    (
      'FIRM-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') || '-' ||
        upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)),
      v_profile.firm_id,
      v_profile.branch_id,
      auth.uid(),
      left(trim(coalesce(p_category, 'general')), 80),
      trim(p_subject),
      trim(p_description),
      v_priority
    )
  returning * into v_ticket;

  return v_ticket;
end;
$$;

revoke all on function public.create_firm_support_ticket(text, text, text, text) from public, anon;
grant execute on function public.create_firm_support_ticket(text, text, text, text) to authenticated;

create or replace function public.list_firm_support_tickets()
returns setof public.platform_support_tickets
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select t.*
  from public.platform_support_tickets t
  where t.requester_id = auth.uid()
     or (
       t.firm_id = public.my_firm_id()
       and exists (
         select 1 from public.user_profiles up
         where up.auth_id = auth.uid()
           and up.active
           and lower(coalesce(up.role, '')) in ('owner', 'admin', 'administrator', 'super owner')
       )
     )
  order by t.created_at desc
  limit 100;
end;
$$;

revoke all on function public.list_firm_support_tickets() from public, anon;
grant execute on function public.list_firm_support_tickets() to authenticated;

create or replace function public.get_platform_support_thread(p_ticket_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.is_saas_admin() then
    raise exception 'platform admin role required' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'ticket', jsonb_build_object(
      'id', t.id, 'ticket_no', t.ticket_no, 'subject', t.subject,
      'status', t.status, 'priority', t.priority, 'firm_id', t.firm_id,
      'created_at', t.created_at, 'updated_at', t.updated_at
    ),
    'messages', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', m.id,
            'body', m.body,
            'visibility', m.visibility,
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
  where t.id = p_ticket_id;

  if v_result is null then
    raise exception 'Support ticket not found';
  end if;
  return v_result;
end;
$$;

revoke all on function public.get_platform_support_thread(uuid) from public, anon;
grant execute on function public.get_platform_support_thread(uuid) to authenticated;

create or replace function public.reply_platform_support_ticket(
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
  if not public.is_saas_admin() then
    raise exception 'platform admin role required' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_body, ''))) not between 1 and 10000 then
    raise exception 'Message must contain between 1 and 10000 characters';
  end if;

  select c.* into v_conversation
  from public.platform_conversations c
  join public.platform_support_tickets t on t.id = c.ticket_id
  where c.ticket_id = p_ticket_id;

  if v_conversation.id is null then
    raise exception 'Support ticket not found';
  end if;

  insert into public.platform_conversation_messages (conversation_id, sender_id, body, visibility)
  values (v_conversation.id, auth.uid(), trim(p_body), 'customer')
  returning * into v_message;

  update public.platform_conversations
  set status = 'open', updated_at = now()
  where id = v_conversation.id;

  update public.platform_support_tickets
  set status = case when status in ('resolved', 'closed') then 'reopened' else 'in_progress' end,
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

revoke all on function public.reply_platform_support_ticket(uuid, text) from public, anon;
grant execute on function public.reply_platform_support_ticket(uuid, text) to authenticated;

drop policy if exists platform_notifications_admin_read on public.platform_notifications;
create policy platform_notifications_admin_read on public.platform_notifications
  for select to authenticated using (public.is_saas_admin());
