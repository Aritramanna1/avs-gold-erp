-- Firm-staff support tickets. The existing platform_support_tickets /
-- platform_conversations tables and the reply/thread RPCs
-- (reply_customer_support_ticket, get_customer_support_thread) already scope
-- purely by firm_id + requester_id — no role check — so they're reused as-is
-- for staff. Only ticket CREATION needed a staff-facing entry point, since
-- create_customer_support_ticket hard-requires role = 'customer'.

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

  select * into v_profile from public.user_profiles
  where auth_id = auth.uid() and active and status = 'active' and firm_id is not null
  limit 1;
  if not found then
    raise exception 'No active firm profile for this account' using errcode = '42501';
  end if;

  insert into public.platform_support_tickets
    (ticket_no, firm_id, branch_id, requester_id, category, subject, description, priority)
  values
    ('STF-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)),
     v_profile.firm_id, v_profile.branch_id, auth.uid(),
     left(trim(coalesce(p_category, 'general')), 80), trim(p_subject), trim(p_description), v_priority)
  returning * into v_ticket;

  return v_ticket;
end;
$$;

revoke all on function public.create_staff_support_ticket(text, text, text, text) from public, anon;
grant execute on function public.create_staff_support_ticket(text, text, text, text) to authenticated;

-- Lists tickets raised by the calling user (staff or customer alike) — used
-- by the staff Support page; customer-portal keeps using get_customer_portal.
create or replace function public.list_my_support_tickets()
returns setof public.platform_support_tickets
language sql
security definer
set search_path = pg_catalog, public
as $$
  select * from public.platform_support_tickets
  where requester_id = auth.uid()
  order by created_at desc;
$$;

revoke all on function public.list_my_support_tickets() from public, anon;
grant execute on function public.list_my_support_tickets() to authenticated;

-- Live chat: stream new replies on a ticket's thread in real time instead of
-- requiring a manual refresh. Existing RLS on platform_conversation_messages
-- (platform_messages_customer_read, scoped to firm_id + requester_id) already
-- covers Realtime's row-level filtering — no policy change needed, just
-- adding the table to the replication publication.
alter publication supabase_realtime add table public.platform_conversation_messages;
