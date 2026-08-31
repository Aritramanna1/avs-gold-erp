-- Additive control-plane primitives for support, notifications and software billing.
create table if not exists public.platform_conversation_participants (
  conversation_id uuid not null references public.platform_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  participant_type text not null default 'member' check (participant_type in ('requester','support','member')),
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  primary key (conversation_id, user_id)
);

create table if not exists public.platform_message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.platform_conversation_messages(id) on delete cascade,
  firm_id uuid references public.organizations(id) on delete restrict,
  bucket text not null,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.platform_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  firm_id uuid references public.organizations(id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  href text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.platform_billing_payments (
  id uuid primary key default gen_random_uuid(),
  billing_document_id uuid not null references public.platform_billing_documents(id) on delete restrict,
  firm_id uuid not null references public.organizations(id) on delete restrict,
  amount_minor bigint not null check (amount_minor > 0),
  method text not null check (method in ('cash','bank','upi','card','other')),
  reference text,
  received_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists platform_notifications_recipient_idx on public.platform_notifications(recipient_id, read_at, created_at desc);
create index if not exists platform_billing_payments_document_idx on public.platform_billing_payments(billing_document_id, received_at desc);
create index if not exists platform_message_attachments_message_idx on public.platform_message_attachments(message_id);

alter table public.platform_conversation_participants enable row level security;
alter table public.platform_message_attachments enable row level security;
alter table public.platform_notifications enable row level security;
alter table public.platform_billing_payments enable row level security;

create policy platform_conversation_participants_admin on public.platform_conversation_participants for all to authenticated using (public.is_saas_admin()) with check (public.is_saas_admin());
create policy platform_message_attachments_admin on public.platform_message_attachments for all to authenticated using (public.is_saas_admin()) with check (public.is_saas_admin());
create policy platform_notifications_recipient on public.platform_notifications for select to authenticated using (recipient_id = auth.uid());
create policy platform_notifications_recipient_update on public.platform_notifications for update to authenticated using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
create policy platform_notifications_admin on public.platform_notifications for insert to authenticated with check (public.is_saas_admin());
create policy platform_billing_payments_admin on public.platform_billing_payments for all to authenticated using (public.is_saas_admin()) with check (public.is_saas_admin());

grant select, insert, update, delete on public.platform_conversation_participants, public.platform_message_attachments, public.platform_billing_payments to authenticated;
grant select, update on public.platform_notifications to authenticated;

create or replace function public.record_platform_notification(
  p_recipient_id uuid, p_kind text, p_title text, p_body text default null, p_href text default null, p_firm_id uuid default null
) returns public.platform_notifications
language plpgsql security definer set search_path = public
as $$
declare result public.platform_notifications;
begin
  if not public.is_saas_admin() then raise exception 'platform admin role required' using errcode = '42501'; end if;
  insert into public.platform_notifications(recipient_id,firm_id,kind,title,body,href)
  values(p_recipient_id,p_firm_id,trim(p_kind),trim(p_title),p_body,p_href) returning * into result;
  return result;
end $$;
revoke execute on function public.record_platform_notification(uuid,text,text,text,text,uuid) from public, anon;
grant execute on function public.record_platform_notification(uuid,text,text,text,text,uuid) to authenticated, service_role;
