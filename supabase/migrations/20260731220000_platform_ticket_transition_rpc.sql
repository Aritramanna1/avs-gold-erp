-- Platform support status changes are validated and audited server-side.
create or replace function public.transition_platform_support_ticket(
  p_ticket_id uuid,
  p_status text
)
returns public.platform_support_tickets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticket public.platform_support_tickets;
  v_previous_status text;
  v_allowed boolean := false;
begin
  if not public.is_saas_admin() then
    raise exception 'Platform administrator access required';
  end if;
  if p_status not in ('open','acknowledged','in_progress','waiting_customer','resolved','closed','reopened') then
    raise exception 'Invalid support ticket status';
  end if;

  select * into v_ticket from public.platform_support_tickets where id = p_ticket_id for update;
  if v_ticket.id is null then raise exception 'Support ticket not found'; end if;
  v_previous_status := v_ticket.status;
  v_allowed :=
    (v_ticket.status = p_status) or
    (v_ticket.status = 'open' and p_status = 'acknowledged') or
    (v_ticket.status = 'acknowledged' and p_status in ('in_progress','waiting_customer')) or
    (v_ticket.status = 'in_progress' and p_status in ('waiting_customer','resolved')) or
    (v_ticket.status = 'waiting_customer' and p_status in ('in_progress','resolved')) or
    (v_ticket.status = 'resolved' and p_status in ('closed','reopened')) or
    (v_ticket.status = 'reopened' and p_status in ('acknowledged','in_progress'));
  if not v_allowed then
    raise exception 'Invalid support ticket transition from % to %', v_ticket.status, p_status;
  end if;

  update public.platform_support_tickets
  set status = p_status,
      resolved_at = case when p_status = 'resolved' then coalesce(resolved_at, now()) when p_status = 'reopened' then null else resolved_at end,
      closed_at = case when p_status = 'closed' then coalesce(closed_at, now()) when p_status = 'reopened' then null else closed_at end,
      updated_at = now()
  where id = p_ticket_id
  returning * into v_ticket;

  insert into public.platform_audit_events
    (actor_id, action, organization_id, target_type, target_id, reason, before_value, after_value)
  values
    (auth.uid(), 'support_ticket.status_changed', v_ticket.firm_id, 'support_ticket', v_ticket.id,
     'Status transition through platform control center',
     jsonb_build_object('status', v_previous_status),
     jsonb_build_object('status', p_status));
  return v_ticket;
end;
$$;

revoke all on function public.transition_platform_support_ticket(uuid, text) from public, anon;
grant execute on function public.transition_platform_support_ticket(uuid, text) to authenticated;
