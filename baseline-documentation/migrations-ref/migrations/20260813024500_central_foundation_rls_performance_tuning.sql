-- Central foundation RLS/performance tuning.
-- Keeps Supabase online-only architecture; no local/offline fallback.

create index if not exists idx_central_activity_events_branch_id
  on public.central_activity_events(branch_id);
create index if not exists idx_central_activity_events_related_party_id
  on public.central_activity_events(related_party_id);
create index if not exists idx_central_message_attachments_firm_id
  on public.central_message_attachments(firm_id);
create index if not exists idx_central_message_attachments_message_id
  on public.central_message_attachments(message_id);
create index if not exists idx_central_message_read_receipts_firm_id
  on public.central_message_read_receipts(firm_id);
create index if not exists idx_central_message_read_receipts_reader_party_id
  on public.central_message_read_receipts(reader_party_id);
create index if not exists idx_central_message_threads_branch_id
  on public.central_message_threads(branch_id);
create index if not exists idx_central_message_threads_party_id
  on public.central_message_threads(party_id);
create index if not exists idx_central_messages_sender_party_id
  on public.central_messages(sender_party_id);
create index if not exists idx_central_parties_default_branch_id
  on public.central_parties(default_branch_id);
create index if not exists idx_central_party_contacts_firm_id
  on public.central_party_contacts(firm_id);
create index if not exists idx_central_party_contacts_party_id
  on public.central_party_contacts(party_id);

-- The original all-actions maintenance write policy also participated in
-- SELECT, creating a duplicate permissive SELECT policy. Split it so the
-- read policy remains explicit and admin writes stay admin-only.
drop policy if exists platform_maintenance_write on public.platform_maintenance_windows;

create policy platform_maintenance_insert on public.platform_maintenance_windows
  for insert to authenticated
  with check (public.is_saas_admin());

create policy platform_maintenance_update on public.platform_maintenance_windows
  for update to authenticated
  using (public.is_saas_admin())
  with check (public.is_saas_admin());

create policy platform_maintenance_delete on public.platform_maintenance_windows
  for delete to authenticated
  using (public.is_saas_admin());
