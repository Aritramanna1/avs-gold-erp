-- Platform operations foundation. Additive only; no tenant ERP data is changed.
create table if not exists public.platform_service_requests (
  id uuid primary key default gen_random_uuid(),
  request_no text not null unique,
  firm_id uuid not null references public.organizations(id),
  branch_id text references public.branches(id),
  requester_id uuid not null references auth.users(id),
  category text not null,
  subject text not null,
  description text not null,
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  status text not null default 'new' check (status in ('new','acknowledged','in_review','assigned','waiting_customer','in_progress','resolved','closed','rejected')),
  assigned_to uuid references auth.users(id),
  internal_notes text,
  customer_reply text,
  resolution text,
  sla_due_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_no text not null unique,
  firm_id uuid not null references public.organizations(id),
  branch_id text references public.branches(id),
  requester_id uuid not null references auth.users(id),
  category text not null,
  module text,
  subject text not null,
  description text not null,
  severity text not null default 'normal' check (severity in ('low','normal','high','critical')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  status text not null default 'open' check (status in ('open','acknowledged','in_progress','waiting_customer','resolved','closed','reopened')),
  assigned_to uuid references auth.users(id),
  resolution text,
  sla_due_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_conversations (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid references public.organizations(id),
  ticket_id uuid references public.platform_support_tickets(id),
  service_request_id uuid references public.platform_service_requests(id),
  status text not null default 'open' check (status in ('open','waiting','closed')),
  assigned_to uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_conversation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.platform_conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id),
  body text not null,
  visibility text not null default 'customer' check (visibility in ('customer','internal')),
  status text not null default 'sent' check (status in ('sent','read','failed')),
  created_at timestamptz not null default now()
);

create table if not exists public.platform_billing_documents (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.organizations(id),
  document_no text not null unique,
  document_type text not null check (document_type in ('quotation','proforma','tax_invoice','renewal_invoice','credit_note','payment_receipt')),
  status text not null default 'draft' check (status in ('draft','issued','partially_paid','paid','overdue','void')),
  amount_minor bigint not null default 0 check (amount_minor >= 0),
  paid_minor bigint not null default 0 check (paid_minor >= 0 and paid_minor <= amount_minor),
  due_at timestamptz,
  issued_at timestamptz,
  data jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_alerts (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid references public.organizations(id),
  severity text not null check (severity in ('info','warning','critical')),
  alert_type text not null,
  title text not null,
  description text,
  acknowledged_at timestamptz,
  acknowledged_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.platform_deployments (
  id uuid primary key default gen_random_uuid(),
  version text not null,
  environment text not null check (environment in ('development','staging','production')),
  status text not null check (status in ('queued','running','succeeded','failed','rolled_back')),
  commit_sha text,
  deployed_by uuid references auth.users(id),
  error_message text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.platform_backup_runs (
  id uuid primary key default gen_random_uuid(),
  backup_type text not null check (backup_type in ('database','storage','full')),
  environment text not null check (environment in ('development','staging','production')),
  status text not null check (status in ('started','succeeded','failed','verified')),
  location text,
  checksum text,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists platform_service_requests_firm_status_idx on public.platform_service_requests(firm_id,status,created_at desc);
create index if not exists platform_support_tickets_firm_status_idx on public.platform_support_tickets(firm_id,status,created_at desc);
create index if not exists platform_conversation_messages_conversation_idx on public.platform_conversation_messages(conversation_id,created_at);
create index if not exists platform_alerts_created_idx on public.platform_alerts(created_at desc);

do $$ declare t text; begin
  foreach t in array array['platform_service_requests','platform_support_tickets','platform_conversations','platform_conversation_messages','platform_billing_documents','platform_alerts','platform_deployments','platform_backup_runs'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

create or replace function public.platform_touch_updated_at() returns trigger language plpgsql set search_path = public as $$ begin new.updated_at = now(); return new; end $$;
do $$ declare t text; begin
  foreach t in array array['platform_service_requests','platform_support_tickets','platform_conversations','platform_billing_documents'] loop
    execute format('drop trigger if exists %I_updated_at on public.%I', t, t);
    execute format('create trigger %I_updated_at before update on public.%I for each row execute function public.platform_touch_updated_at()', t, t);
  end loop;
end $$;

create policy platform_service_requests_admin on public.platform_service_requests for all to authenticated using (public.is_saas_admin()) with check (public.is_saas_admin());
create policy platform_service_requests_firm_read on public.platform_service_requests for select to authenticated using (firm_id = public.my_firm_id() and requester_id = auth.uid());
create policy platform_service_requests_firm_create on public.platform_service_requests for insert to authenticated with check (firm_id = public.my_firm_id() and requester_id = auth.uid());
create policy platform_support_tickets_admin on public.platform_support_tickets for all to authenticated using (public.is_saas_admin()) with check (public.is_saas_admin());
create policy platform_support_tickets_firm_read on public.platform_support_tickets for select to authenticated using (firm_id = public.my_firm_id() and requester_id = auth.uid());
create policy platform_support_tickets_firm_create on public.platform_support_tickets for insert to authenticated with check (firm_id = public.my_firm_id() and requester_id = auth.uid());
create policy platform_conversations_admin on public.platform_conversations for all to authenticated using (public.is_saas_admin()) with check (public.is_saas_admin());
create policy platform_conversation_messages_admin on public.platform_conversation_messages for all to authenticated using (public.is_saas_admin()) with check (public.is_saas_admin());
create policy platform_billing_documents_admin on public.platform_billing_documents for all to authenticated using (public.is_saas_admin()) with check (public.is_saas_admin());
create policy platform_alerts_admin on public.platform_alerts for all to authenticated using (public.is_saas_admin()) with check (public.is_saas_admin());
create policy platform_deployments_admin on public.platform_deployments for all to authenticated using (public.is_saas_admin()) with check (public.is_saas_admin());
create policy platform_backup_runs_admin on public.platform_backup_runs for all to authenticated using (public.is_saas_admin()) with check (public.is_saas_admin());

grant select, insert on public.platform_service_requests, public.platform_support_tickets to authenticated;
grant select, insert, update, delete on public.platform_conversations, public.platform_conversation_messages, public.platform_billing_documents, public.platform_alerts, public.platform_deployments, public.platform_backup_runs to authenticated;
