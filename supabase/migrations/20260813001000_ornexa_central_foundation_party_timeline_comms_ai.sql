-- Ornexa central foundation: party, activity timeline, communications, API key metadata,
-- maintenance states, and assistant action audit.
--
-- This migration is Supabase-online only. It does not add offline/hybrid/local
-- persistence. It is intentionally additive so existing AVS history remains intact.

create table if not exists public.central_parties (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null default public.my_firm_id() references public.organizations(id) on delete cascade,
  party_code text,
  display_name text not null,
  legal_name text,
  party_kind text not null default 'organization'
    check (party_kind in ('person','organization','internal_branch','other')),
  status text not null default 'active'
    check (status in ('active','inactive','blocked','archived')),
  gstin text,
  pan text,
  primary_phone text,
  primary_email text,
  default_branch_id text references public.branches(id) on delete set null,
  opening_cash_balance_paise bigint not null default 0,
  opening_fine_gold_mg bigint not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint central_parties_code_per_firm unique (firm_id, party_code)
);

create table if not exists public.central_party_roles (
  party_id uuid not null references public.central_parties(id) on delete cascade,
  firm_id uuid not null default public.my_firm_id() references public.organizations(id) on delete cascade,
  role text not null check (
    role in (
      'customer','supplier','karigar','refinery','hallmark_vendor','service_provider',
      'employee','carrier','sales_partner','billing_party','other_counterparty'
    )
  ),
  status text not null default 'active' check (status in ('active','inactive','blocked')),
  role_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (party_id, role)
);

create table if not exists public.central_party_contacts (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.central_parties(id) on delete cascade,
  firm_id uuid not null default public.my_firm_id() references public.organizations(id) on delete cascade,
  contact_type text not null default 'phone'
    check (contact_type in ('phone','email','whatsapp','address','gst_address','other')),
  label text,
  value text not null,
  is_primary boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.central_activity_events (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null default public.my_firm_id() references public.organizations(id) on delete cascade,
  branch_id text references public.branches(id) on delete set null,
  entity_type text not null,
  entity_id text not null,
  event_type text not null,
  title text not null,
  description text,
  actor_id uuid default auth.uid(),
  related_party_id uuid references public.central_parties(id) on delete set null,
  related_transaction_id uuid,
  related_document_id text,
  severity text not null default 'info' check (severity in ('info','success','warning','error','critical')),
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.central_message_threads (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null default public.my_firm_id() references public.organizations(id) on delete cascade,
  branch_id text references public.branches(id) on delete set null,
  subject text,
  channel text not null default 'in_app'
    check (channel in ('in_app','whatsapp','email','sms','voice','imported','other')),
  status text not null default 'open'
    check (status in ('open','pending','resolved','closed','archived')),
  priority text not null default 'normal'
    check (priority in ('low','normal','medium','high','urgent')),
  party_id uuid references public.central_parties(id) on delete set null,
  linked_entity_type text,
  linked_entity_id text,
  assigned_to uuid,
  last_message_at timestamptz,
  last_read_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.central_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.central_message_threads(id) on delete cascade,
  firm_id uuid not null default public.my_firm_id() references public.organizations(id) on delete cascade,
  sender_user_id uuid,
  sender_party_id uuid references public.central_parties(id) on delete set null,
  direction text not null default 'outbound' check (direction in ('inbound','outbound','internal')),
  message_type text not null default 'text' check (message_type in ('text','file','image','audio','system','template')),
  body text,
  provider text,
  provider_message_id text,
  imported_from text,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.central_message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.central_messages(id) on delete cascade,
  firm_id uuid not null default public.my_firm_id() references public.organizations(id) on delete cascade,
  storage_bucket text not null,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  checksum_sha256 text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.central_message_read_receipts (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.central_messages(id) on delete cascade,
  firm_id uuid not null default public.my_firm_id() references public.organizations(id) on delete cascade,
  reader_user_id uuid,
  reader_party_id uuid references public.central_parties(id) on delete cascade,
  read_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint central_message_read_receipts_reader_present
    check (reader_user_id is not null or reader_party_id is not null)
);

create table if not exists public.platform_api_key_registry (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid references public.organizations(id) on delete cascade,
  scope text not null default 'firm' check (scope in ('platform','firm')),
  provider text not null,
  key_label text not null,
  secret_ref text not null,
  secret_fingerprint text,
  status text not null default 'active' check (status in ('active','disabled','rotated','revoked')),
  last_test_status text check (last_test_status in ('pass','fail','unknown')),
  last_test_at timestamptz,
  expires_at timestamptz,
  created_by uuid default auth.uid(),
  rotated_at timestamptz,
  revoked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_api_key_registry_unique_label unique (firm_id, provider, key_label)
);

create table if not exists public.platform_maintenance_windows (
  id uuid primary key default gen_random_uuid(),
  scope text not null default 'platform' check (scope in ('platform','firm')),
  firm_id uuid references public.organizations(id) on delete cascade,
  title text not null,
  message text not null,
  status text not null default 'scheduled'
    check (status in ('scheduled','active','resolved','cancelled')),
  severity text not null default 'info' check (severity in ('info','warning','critical')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  created_by uuid default auth.uid(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assistant_action_audit (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null default public.my_firm_id() references public.organizations(id) on delete cascade,
  conversation_id uuid,
  message_id uuid,
  actor_id uuid default auth.uid(),
  action_key text not null,
  action_type text not null default 'read' check (action_type in ('read','suggest','mutate','export','message')),
  target_type text,
  target_id text,
  status text not null default 'requested'
    check (status in ('requested','confirmed','executed','rejected','failed')),
  requires_confirmation boolean not null default true,
  request_payload jsonb not null default '{}'::jsonb,
  result_payload jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  executed_at timestamptz
);

create index if not exists idx_central_parties_firm_name on public.central_parties(firm_id, display_name);
create index if not exists idx_central_parties_firm_status on public.central_parties(firm_id, status);
create index if not exists idx_central_party_roles_firm_role on public.central_party_roles(firm_id, role);
create index if not exists idx_central_activity_entity on public.central_activity_events(firm_id, entity_type, entity_id, occurred_at desc);
create index if not exists idx_central_activity_party on public.central_activity_events(firm_id, related_party_id, occurred_at desc);
create index if not exists idx_central_threads_firm_status on public.central_message_threads(firm_id, status, updated_at desc);
create index if not exists idx_central_threads_party on public.central_message_threads(firm_id, party_id, updated_at desc);
create index if not exists idx_central_messages_thread on public.central_messages(thread_id, created_at);
create index if not exists idx_central_messages_provider on public.central_messages(firm_id, provider, provider_message_id);
create unique index if not exists uq_message_read_receipt_user
  on public.central_message_read_receipts(message_id, reader_user_id)
  where reader_user_id is not null;
create unique index if not exists uq_message_read_receipt_party
  on public.central_message_read_receipts(message_id, reader_party_id)
  where reader_party_id is not null;
create index if not exists idx_platform_api_keys_firm_provider on public.platform_api_key_registry(firm_id, provider);
create index if not exists idx_platform_maintenance_active on public.platform_maintenance_windows(status, starts_at, ends_at);
create index if not exists idx_assistant_action_audit_firm on public.assistant_action_audit(firm_id, created_at desc);

alter table public.central_parties enable row level security;
alter table public.central_party_roles enable row level security;
alter table public.central_party_contacts enable row level security;
alter table public.central_activity_events enable row level security;
alter table public.central_message_threads enable row level security;
alter table public.central_messages enable row level security;
alter table public.central_message_attachments enable row level security;
alter table public.central_message_read_receipts enable row level security;
alter table public.platform_api_key_registry enable row level security;
alter table public.platform_maintenance_windows enable row level security;
alter table public.assistant_action_audit enable row level security;

grant select, insert, update on
  public.central_parties,
  public.central_party_roles,
  public.central_party_contacts,
  public.central_activity_events,
  public.central_message_threads,
  public.central_messages,
  public.central_message_attachments,
  public.central_message_read_receipts,
  public.platform_api_key_registry,
  public.platform_maintenance_windows,
  public.assistant_action_audit
to authenticated;

grant all on
  public.central_parties,
  public.central_party_roles,
  public.central_party_contacts,
  public.central_activity_events,
  public.central_message_threads,
  public.central_messages,
  public.central_message_attachments,
  public.central_message_read_receipts,
  public.platform_api_key_registry,
  public.platform_maintenance_windows,
  public.assistant_action_audit
to service_role;

do $$
declare
  t text;
  tables text[] := array[
    'central_parties',
    'central_party_roles',
    'central_party_contacts',
    'central_activity_events',
    'central_message_threads',
    'central_messages',
    'central_message_attachments',
    'central_message_read_receipts',
    'assistant_action_audit'
  ];
begin
  foreach t in array tables loop
    execute format('drop policy if exists %I on public.%I', t || '_firm_read', t);
    execute format('drop policy if exists %I on public.%I', t || '_firm_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_firm_update', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (firm_id = public.my_firm_id() or public.has_role(auth.uid(), ''saas_admin''::public.app_role))',
      t || '_firm_read', t
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (firm_id = public.my_firm_id() and not public.has_role(auth.uid(), ''viewer''::public.app_role))',
      t || '_firm_insert', t
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using ((firm_id = public.my_firm_id() or public.has_role(auth.uid(), ''saas_admin''::public.app_role)) and not public.has_role(auth.uid(), ''viewer''::public.app_role)) with check (firm_id = public.my_firm_id() and not public.has_role(auth.uid(), ''viewer''::public.app_role))',
      t || '_firm_update', t
    );
  end loop;
end $$;

drop policy if exists platform_api_key_registry_read on public.platform_api_key_registry;
drop policy if exists platform_api_key_registry_insert on public.platform_api_key_registry;
drop policy if exists platform_api_key_registry_update on public.platform_api_key_registry;
create policy platform_api_key_registry_read on public.platform_api_key_registry
  for select to authenticated
  using (
    public.has_role(auth.uid(), 'saas_admin'::public.app_role)
    or (firm_id = public.my_firm_id() and (
      public.has_role(auth.uid(), 'owner'::public.app_role)
      or public.has_role(auth.uid(), 'admin'::public.app_role)
    ))
  );
create policy platform_api_key_registry_insert on public.platform_api_key_registry
  for insert to authenticated
  with check (
    (scope = 'platform' and public.has_role(auth.uid(), 'saas_admin'::public.app_role))
    or (scope = 'firm' and firm_id = public.my_firm_id() and (
      public.has_role(auth.uid(), 'owner'::public.app_role)
      or public.has_role(auth.uid(), 'admin'::public.app_role)
    ))
  );
create policy platform_api_key_registry_update on public.platform_api_key_registry
  for update to authenticated
  using (
    public.has_role(auth.uid(), 'saas_admin'::public.app_role)
    or (firm_id = public.my_firm_id() and (
      public.has_role(auth.uid(), 'owner'::public.app_role)
      or public.has_role(auth.uid(), 'admin'::public.app_role)
    ))
  )
  with check (
    public.has_role(auth.uid(), 'saas_admin'::public.app_role)
    or (firm_id = public.my_firm_id() and (
      public.has_role(auth.uid(), 'owner'::public.app_role)
      or public.has_role(auth.uid(), 'admin'::public.app_role)
    ))
  );

drop policy if exists platform_maintenance_read on public.platform_maintenance_windows;
drop policy if exists platform_maintenance_write on public.platform_maintenance_windows;
create policy platform_maintenance_read on public.platform_maintenance_windows
  for select to authenticated
  using (scope = 'platform' or firm_id = public.my_firm_id() or public.has_role(auth.uid(), 'saas_admin'::public.app_role));
create policy platform_maintenance_write on public.platform_maintenance_windows
  for all to authenticated
  using (public.has_role(auth.uid(), 'saas_admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'saas_admin'::public.app_role));

drop trigger if exists trg_central_parties_updated_at on public.central_parties;
create trigger trg_central_parties_updated_at before update on public.central_parties
  for each row execute function public.set_updated_at();

drop trigger if exists trg_central_party_roles_updated_at on public.central_party_roles;
create trigger trg_central_party_roles_updated_at before update on public.central_party_roles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_central_party_contacts_updated_at on public.central_party_contacts;
create trigger trg_central_party_contacts_updated_at before update on public.central_party_contacts
  for each row execute function public.set_updated_at();

drop trigger if exists trg_central_message_threads_updated_at on public.central_message_threads;
create trigger trg_central_message_threads_updated_at before update on public.central_message_threads
  for each row execute function public.set_updated_at();

drop trigger if exists trg_platform_api_key_registry_updated_at on public.platform_api_key_registry;
create trigger trg_platform_api_key_registry_updated_at before update on public.platform_api_key_registry
  for each row execute function public.set_updated_at();

drop trigger if exists trg_platform_maintenance_windows_updated_at on public.platform_maintenance_windows;
create trigger trg_platform_maintenance_windows_updated_at before update on public.platform_maintenance_windows
  for each row execute function public.set_updated_at();

create or replace function public.central_track_activity(
  p_entity_type text,
  p_entity_id text,
  p_event_type text,
  p_title text,
  p_description text default null,
  p_branch_id text default null,
  p_related_party_id uuid default null,
  p_related_transaction_id uuid default null,
  p_related_document_id text default null,
  p_severity text default 'info',
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_event_id uuid;
begin
  if public.my_firm_id() is null then
    raise exception 'No firm is attached to the current session.';
  end if;

  insert into public.central_activity_events (
    firm_id, branch_id, entity_type, entity_id, event_type, title, description,
    actor_id, related_party_id, related_transaction_id, related_document_id,
    severity, metadata
  )
  values (
    public.my_firm_id(), p_branch_id, p_entity_type, p_entity_id, p_event_type,
    p_title, p_description, auth.uid(), p_related_party_id, p_related_transaction_id,
    p_related_document_id, coalesce(p_severity, 'info'), coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_event_id;

  return v_event_id;
end;
$$;

revoke all on function public.central_track_activity(text, text, text, text, text, text, uuid, uuid, text, text, jsonb) from public, anon;
grant execute on function public.central_track_activity(text, text, text, text, text, text, uuid, uuid, text, text, jsonb) to authenticated, service_role;
