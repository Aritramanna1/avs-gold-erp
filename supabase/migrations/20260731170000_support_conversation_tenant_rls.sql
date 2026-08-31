-- Allow a tenant requester to use support conversations without exposing
-- another firm's conversations or internal support messages.

create policy platform_conversations_member_read
  on public.platform_conversations for select to authenticated
  using (
    firm_id = public.my_firm_id()
    and exists (
      select 1 from public.platform_conversation_participants p
      where p.conversation_id = id and p.user_id = auth.uid()
    )
  );

create policy platform_conversations_member_create
  on public.platform_conversations for insert to authenticated
  with check (firm_id = public.my_firm_id());

create policy platform_conversations_member_update
  on public.platform_conversations for update to authenticated
  using (
    firm_id = public.my_firm_id()
    and exists (
      select 1 from public.platform_conversation_participants p
      where p.conversation_id = id and p.user_id = auth.uid()
    )
  )
  with check (firm_id = public.my_firm_id());

create policy platform_conversation_participants_member_read
  on public.platform_conversation_participants for select to authenticated
  using (user_id = auth.uid());

create policy platform_conversation_participants_member_join
  on public.platform_conversation_participants for insert to authenticated
  with check (user_id = auth.uid());

create policy platform_conversation_messages_member_read
  on public.platform_conversation_messages for select to authenticated
  using (
    visibility = 'customer'
    and exists (
      select 1
      from public.platform_conversation_participants p
      join public.platform_conversations c on c.id = conversation_id
      where p.conversation_id = platform_conversation_messages.conversation_id
        and p.user_id = auth.uid()
        and c.firm_id = public.my_firm_id()
    )
  );

create policy platform_conversation_messages_member_create
  on public.platform_conversation_messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and visibility = 'customer'
    and exists (
      select 1
      from public.platform_conversation_participants p
      join public.platform_conversations c on c.id = conversation_id
      where p.conversation_id = platform_conversation_messages.conversation_id
        and p.user_id = auth.uid()
        and c.firm_id = public.my_firm_id()
    )
  );

create policy platform_conversation_messages_member_read_update
  on public.platform_conversation_messages for update to authenticated
  using (
    visibility = 'customer'
    and exists (
      select 1 from public.platform_conversation_participants p
      where p.conversation_id = platform_conversation_messages.conversation_id
        and p.user_id = auth.uid()
    )
  )
  with check (visibility = 'customer');

