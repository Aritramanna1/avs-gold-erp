-- Reconciled from production (project dqgrrafuoxaorvyrcuuh) on 2026-08-11 — this migration was applied directly to Supabase and had no local file until now.

-- Notify platform admins and firm staff when support tickets are created.

begin;

create or replace function public.notify_support_ticket_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipient uuid;
  v_platform_href text := '/platform?view=tickets';
  v_firm_href text := '/communications/customer-tickets';
begin
  for v_recipient in
    select ur.user_id
    from public.user_roles ur
    where ur.role = 'saas_admin'::public.app_role
  loop
    insert into public.platform_notifications (recipient_id, firm_id, kind, title, body, href)
    values (
      v_recipient,
      new.firm_id,
      'support_ticket',
      'New support ticket',
      new.ticket_no || ' · ' || left(trim(new.subject), 120),
      v_platform_href
    );
  end loop;

  if new.ticket_no like 'CUS-%' and new.firm_id is not null then
    for v_recipient in
      select up.auth_id
      from public.user_profiles up
      where up.firm_id = new.firm_id
        and up.active
        and up.status = 'active'
        and up.auth_id is not null
        and lower(coalesce(up.role, '')) in (
          'owner',
          'admin',
          'administrator',
          'super owner',
          'branch manager',
          'ceo'
        )
    loop
      insert into public.platform_notifications (recipient_id, firm_id, kind, title, body, href)
      values (
        v_recipient,
        new.firm_id,
        'customer_support_ticket',
        'Customer support ticket',
        new.ticket_no || ' · ' || left(trim(new.subject), 120),
        v_firm_href
      );
    end loop;
  end if;

  return new;
end;
$$;

drop trigger if exists platform_support_ticket_notify on public.platform_support_tickets;
create trigger platform_support_ticket_notify
after insert on public.platform_support_tickets
for each row
execute function public.notify_support_ticket_created();

create or replace function public.create_customer_support_ticket(
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
  v_conversation_id uuid;
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
    and lower(coalesce(role, '')) = 'customer'
    and firm_id is not null
  limit 1;

  if not found then
    raise exception 'customer portal access is not configured' using errcode = '42501';
  end if;

  insert into public.platform_support_tickets
    (ticket_no, firm_id, branch_id, requester_id, category, subject, description, priority)
  values
    (
      'CUS-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') || '-' ||
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

  select c.id into v_conversation_id
  from public.platform_conversations c
  where c.ticket_id = v_ticket.id;

  if v_conversation_id is not null then
    insert into public.platform_conversation_messages (conversation_id, sender_id, body, visibility)
    values (v_conversation_id, auth.uid(), trim(p_description), 'customer');
  end if;

  return v_ticket;
end;
$$;

commit;
