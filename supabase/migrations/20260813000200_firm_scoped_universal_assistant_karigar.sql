-- AVS / Ornexa firm-scoped foundation for universal transactions,
-- assistant persistence, and Karigar portal access.
--
-- This supersedes the earlier tenant_id draft migrations for the current
-- live schema, which scopes operational data by firm_id via user_profiles
-- and public.my_firm_id().

create table if not exists public.universal_transaction_definitions (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid,
  code text not null,
  name text not null,
  category text not null default 'workshop',
  counterparty_type text not null default 'none',
  fields_schema jsonb not null default '[]'::jsonb,
  posting_rules jsonb not null default '{}'::jsonb,
  is_system boolean not null default false,
  is_active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint universal_transaction_definitions_code_scope
    unique (firm_id, code)
);

create table if not exists public.universal_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null,
  branch_id text,
  transaction_definition_id uuid references public.universal_transaction_definitions(id) on delete restrict,
  voucher_number text not null,
  voucher_date timestamptz not null default now(),
  counterparty_id text,
  counterparty_name text,
  gross_weight_mg bigint not null default 0,
  less_weight_mg bigint not null default 0,
  net_weight_mg bigint not null default 0,
  fine_gold_debit_mg bigint not null default 0,
  fine_gold_credit_mg bigint not null default 0,
  fine_silver_debit_mg bigint not null default 0,
  fine_silver_credit_mg bigint not null default 0,
  cash_debit_paise bigint not null default 0,
  cash_credit_paise bigint not null default 0,
  stone_carats numeric(10, 4) not null default 0,
  pieces integer not null default 0,
  waiting_on text,
  commitment_due_at timestamptz,
  status text not null default 'posted',
  reversal_ref_id uuid references public.universal_ledger_entries(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint universal_ledger_entries_status_check
    check (status in ('draft', 'posted', 'reversed', 'cancelled'))
);

create index if not exists universal_transaction_definitions_firm_idx
  on public.universal_transaction_definitions (firm_id, code);
create index if not exists universal_ledger_entries_firm_date_idx
  on public.universal_ledger_entries (firm_id, voucher_date desc);
create index if not exists universal_ledger_entries_counterparty_idx
  on public.universal_ledger_entries (firm_id, counterparty_id);
create index if not exists universal_ledger_entries_branch_idx
  on public.universal_ledger_entries (firm_id, branch_id);

alter table public.universal_transaction_definitions enable row level security;
alter table public.universal_ledger_entries enable row level security;

drop policy if exists universal_transaction_definitions_read on public.universal_transaction_definitions;
create policy universal_transaction_definitions_read on public.universal_transaction_definitions
for select to authenticated
using (is_system or firm_id = public.my_firm_id() or public.is_saas_admin());

drop policy if exists universal_transaction_definitions_manage on public.universal_transaction_definitions;
create policy universal_transaction_definitions_manage on public.universal_transaction_definitions
for all to authenticated
using (
  public.is_saas_admin()
  or exists (
    select 1
    from public.user_profiles up
    where up.auth_id = auth.uid()
      and up.firm_id = universal_transaction_definitions.firm_id
      and up.active
      and up.status = 'active'
      and up.role in ('owner', 'tenant_owner', 'super_admin', 'admin')
  )
)
with check (
  public.is_saas_admin()
  or exists (
    select 1
    from public.user_profiles up
    where up.auth_id = auth.uid()
      and up.firm_id = universal_transaction_definitions.firm_id
      and up.active
      and up.status = 'active'
      and up.role in ('owner', 'tenant_owner', 'super_admin', 'admin')
  )
);

drop policy if exists universal_ledger_entries_read on public.universal_ledger_entries;
create policy universal_ledger_entries_read on public.universal_ledger_entries
for select to authenticated
using (firm_id = public.my_firm_id() or public.is_saas_admin());

drop policy if exists universal_ledger_entries_insert on public.universal_ledger_entries;
create policy universal_ledger_entries_insert on public.universal_ledger_entries
for insert to authenticated
with check (firm_id = public.my_firm_id() or public.is_saas_admin());

revoke all on public.universal_transaction_definitions from anon;
revoke all on public.universal_ledger_entries from anon;
grant select, insert, update, delete on public.universal_transaction_definitions to authenticated;
grant select, insert on public.universal_ledger_entries to authenticated;

create or replace function public.rpc_post_universal_transaction(
  p_firm_id uuid,
  p_branch_id text,
  p_transaction_code text,
  p_voucher_number text,
  p_counterparty_id text default null,
  p_counterparty_name text default null,
  p_gross_weight_mg bigint default 0,
  p_less_weight_mg bigint default 0,
  p_net_weight_mg bigint default 0,
  p_fine_gold_debit_mg bigint default 0,
  p_fine_gold_credit_mg bigint default 0,
  p_cash_debit_paise bigint default 0,
  p_cash_credit_paise bigint default 0,
  p_waiting_on text default null,
  p_commitment_due_at timestamptz default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_def_id uuid;
  v_entry_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if not (public.is_saas_admin() or p_firm_id = public.my_firm_id()) then
    raise exception 'firm access denied' using errcode = '42501';
  end if;
  if nullif(trim(coalesce(p_transaction_code, '')), '') is null then
    raise exception 'transaction code is required' using errcode = '22023';
  end if;
  if nullif(trim(coalesce(p_voucher_number, '')), '') is null then
    raise exception 'voucher number is required' using errcode = '22023';
  end if;

  select id into v_def_id
  from public.universal_transaction_definitions
  where code = trim(p_transaction_code)
    and is_active
    and (firm_id = p_firm_id or is_system)
  order by case when firm_id = p_firm_id then 0 else 1 end
  limit 1;

  if v_def_id is null then
    raise exception 'transaction definition not found' using errcode = '22023';
  end if;

  insert into public.universal_ledger_entries (
    firm_id, branch_id, transaction_definition_id, voucher_number,
    counterparty_id, counterparty_name, gross_weight_mg, less_weight_mg,
    net_weight_mg, fine_gold_debit_mg, fine_gold_credit_mg,
    cash_debit_paise, cash_credit_paise, waiting_on, commitment_due_at,
    metadata, created_by
  ) values (
    p_firm_id, p_branch_id, v_def_id, trim(p_voucher_number),
    p_counterparty_id, p_counterparty_name, coalesce(p_gross_weight_mg, 0),
    coalesce(p_less_weight_mg, 0), coalesce(p_net_weight_mg, 0),
    coalesce(p_fine_gold_debit_mg, 0), coalesce(p_fine_gold_credit_mg, 0),
    coalesce(p_cash_debit_paise, 0), coalesce(p_cash_credit_paise, 0),
    p_waiting_on, p_commitment_due_at, coalesce(p_metadata, '{}'::jsonb),
    auth.uid()
  )
  returning id into v_entry_id;

  return v_entry_id;
end;
$$;

revoke all on function public.rpc_post_universal_transaction(uuid, text, text, text, text, text, bigint, bigint, bigint, bigint, bigint, bigint, bigint, text, timestamptz, jsonb) from public, anon;
grant execute on function public.rpc_post_universal_transaction(uuid, text, text, text, text, text, bigint, bigint, bigint, bigint, bigint, bigint, bigint, text, timestamptz, jsonb) to authenticated;

create table if not exists public.assistant_conversations (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null,
  user_id uuid not null,
  title text not null default 'New Conversation',
  provider text not null default 'cloudflare_ai_gateway',
  model text not null default '@cf/meta/llama-3-8b-instruct',
  is_pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assistant_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.assistant_conversations(id) on delete cascade,
  firm_id uuid not null,
  role text not null default 'user',
  content text not null,
  tool_calls jsonb not null default '[]'::jsonb,
  erp_card jsonb,
  tokens_used integer not null default 0,
  created_at timestamptz not null default now(),
  constraint assistant_messages_role_check
    check (role in ('system', 'user', 'assistant', 'tool'))
);

create table if not exists public.ai_provider_configs (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null,
  provider text not null,
  model_name text not null,
  is_enabled boolean not null default true,
  max_monthly_tokens integer not null default 500000,
  tokens_used_this_month integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_provider_configs_firm_provider_key unique (firm_id, provider)
);

create index if not exists assistant_conversations_firm_user_idx
  on public.assistant_conversations (firm_id, user_id, updated_at desc);
create index if not exists assistant_messages_conversation_idx
  on public.assistant_messages (conversation_id, created_at);
create index if not exists assistant_messages_firm_idx
  on public.assistant_messages (firm_id, created_at desc);

alter table public.assistant_conversations enable row level security;
alter table public.assistant_messages enable row level security;
alter table public.ai_provider_configs enable row level security;

drop policy if exists assistant_conversations_owner on public.assistant_conversations;
create policy assistant_conversations_owner on public.assistant_conversations
for all to authenticated
using ((firm_id = public.my_firm_id() and user_id = auth.uid()) or public.is_saas_admin())
with check ((firm_id = public.my_firm_id() and user_id = auth.uid()) or public.is_saas_admin());

drop policy if exists assistant_messages_owner on public.assistant_messages;
create policy assistant_messages_owner on public.assistant_messages
for all to authenticated
using (
  public.is_saas_admin()
  or exists (
    select 1
    from public.assistant_conversations c
    where c.id = assistant_messages.conversation_id
      and c.firm_id = public.my_firm_id()
      and c.user_id = auth.uid()
      and c.firm_id = assistant_messages.firm_id
  )
)
with check (
  public.is_saas_admin()
  or exists (
    select 1
    from public.assistant_conversations c
    where c.id = assistant_messages.conversation_id
      and c.firm_id = public.my_firm_id()
      and c.user_id = auth.uid()
      and c.firm_id = assistant_messages.firm_id
  )
);

drop policy if exists ai_provider_configs_admin_read on public.ai_provider_configs;
create policy ai_provider_configs_admin_read on public.ai_provider_configs
for select to authenticated
using (
  public.is_saas_admin()
  or exists (
    select 1
    from public.user_profiles up
    where up.auth_id = auth.uid()
      and up.firm_id = ai_provider_configs.firm_id
      and up.active
      and up.status = 'active'
      and up.role in ('owner', 'tenant_owner', 'super_admin', 'admin')
  )
);

drop policy if exists ai_provider_configs_saas_manage on public.ai_provider_configs;
create policy ai_provider_configs_saas_manage on public.ai_provider_configs
for all to authenticated
using (public.is_saas_admin())
with check (public.is_saas_admin());

revoke all on public.assistant_conversations from anon;
revoke all on public.assistant_messages from anon;
revoke all on public.ai_provider_configs from anon;
grant select, insert, update, delete on public.assistant_conversations to authenticated;
grant select, insert, update, delete on public.assistant_messages to authenticated;
grant select, insert, update, delete on public.ai_provider_configs to authenticated;

create or replace function public.get_karigar_portal()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_user_email text;
  v_user_phone text;
  v_firm_id uuid := public.my_firm_id();
  v_worker_id text;
  v_worker_name text;
  v_gold_balance jsonb;
  v_gold_entries jsonb;
  v_wages jsonb;
  v_attendance jsonb;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if v_firm_id is null then
    raise exception 'No active firm profile for this account' using errcode = '42501';
  end if;

  select coalesce(u.email, ''), coalesce(u.phone, '')
  into v_user_email, v_user_phone
  from auth.users u
  where u.id = v_user_id;

  select p.id, coalesce(p.data->>'fullName', p.data->>'name', p.id)
  into v_worker_id, v_worker_name
  from public.people p
  where p.firm_id = v_firm_id
    and (p.data->>'type' in ('karigar', 'worker') or p.data->>'role' in ('karigar', 'worker'))
    and (
      (nullif(v_user_phone, '') is not null and p.data->>'phone' = v_user_phone)
      or (nullif(v_user_email, '') is not null and lower(p.data->>'email') = lower(v_user_email))
    )
  limit 1;

  if v_worker_id is null then
    return jsonb_build_object(
      'found', false,
      'message', 'No karigar profile linked to this account. Contact your firm administrator.'
    );
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', gl.id,
      'ts', gl.ts,
      'type', gl.data->>'type',
      'narration', gl.data->>'narration',
      'netFineMg', gl.data->'netFineMg',
      'grossMg', gl.data->'grossMg',
      'purity', gl.data->'purity',
      'slipNo', gl.data->>'slipNo'
    )
    order by gl.ts desc
  ), '[]'::jsonb)
  into v_gold_entries
  from public.gold_ledger gl
  where gl.firm_id = v_firm_id
    and gl.data->>'karigarId' = v_worker_id
    and gl.ts > now() - interval '90 days';

  select jsonb_build_object(
    'issuedMg', coalesce(sum(case when fine_mg < 0 then abs(fine_mg) else 0 end), 0),
    'receivedMg', coalesce(sum(case when fine_mg > 0 then fine_mg else 0 end), 0),
    'balanceMg', coalesce(-sum(fine_mg), 0)
  )
  into v_gold_balance
  from (
    select (gl.data->>'netFineMg')::numeric as fine_mg
    from public.gold_ledger gl
    where gl.firm_id = v_firm_id
      and gl.data->>'karigarId' = v_worker_id
      and gl.data->>'netFineMg' ~ '^-?[0-9]+(\\.[0-9]+)?$'
  ) numeric_gold;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'date', a.data->>'date',
      'status', a.data->>'status',
      'inTime', a.data->>'inTime',
      'outTime', a.data->>'outTime'
    )
    order by a.data->>'date' desc
  ), '[]'::jsonb)
  into v_attendance
  from public.attendance a
  where a.firm_id = v_firm_id
    and a.data->>'workerId' = v_worker_id
    and (a.data->>'date')::date > current_date - interval '30 days';

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', wt.id,
      'kind', wt.kind,
      'ts', wt.ts,
      'amount', wt.data->'amount',
      'notes', wt.data->>'notes'
    )
    order by wt.ts desc
  ), '[]'::jsonb)
  into v_wages
  from public.worker_transactions wt
  where wt.firm_id = v_firm_id
    and wt.data->>'workerId' = v_worker_id
    and wt.ts > now() - interval '90 days';

  return jsonb_build_object(
    'found', true,
    'profile', jsonb_build_object('id', v_worker_id, 'name', v_worker_name, 'firmId', v_firm_id),
    'goldBalance', coalesce(v_gold_balance, '{"issuedMg":0,"receivedMg":0,"balanceMg":0}'::jsonb),
    'goldEntries', v_gold_entries,
    'wages', v_wages,
    'attendance', v_attendance
  );
end;
$$;

revoke all on function public.get_karigar_portal() from public, anon;
grant execute on function public.get_karigar_portal() to authenticated;

comment on function public.get_karigar_portal() is
  'Karigar self-service portal RPC scoped by the caller firm profile; returns only the matching worker profile, gold balance, wages, and attendance.';
