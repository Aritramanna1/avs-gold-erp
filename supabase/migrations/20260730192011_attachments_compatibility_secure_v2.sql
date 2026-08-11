-- Reconciled from production (project dqgrrafuoxaorvyrcuuh) on 2026-08-11 — this migration was applied directly to Supabase and had no local file until now.

create table if not exists public.attachments (
  id text primary key, kind text not null, linked_table text not null, linked_id text not null,
  file_name text, storage_path text, mime_type text, size_bytes integer,
  data jsonb not null default '{}'::jsonb, firm_id uuid references public.organizations(id),
  branch_id text references public.branches(id), uploaded_by uuid references auth.users(id),
  storage_provider text, file_path text, file_url text, original_file_name text, file_size integer,
  related_module text, related_table text, related_record_id uuid, notes text,
  is_deleted boolean not null default false, uploaded_at timestamptz not null default now(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists attachments_firm_idx on public.attachments(firm_id);
create index if not exists attachments_branch_idx on public.attachments(branch_id);
create index if not exists attachments_link_idx on public.attachments(related_table, related_record_id);
alter table public.attachments enable row level security;
alter table public.attachments force row level security;
drop policy if exists "Allow authenticated read on attachments" on public.attachments;
drop policy if exists "Allow authenticated insert on attachments" on public.attachments;
drop policy if exists "Allow authenticated update on attachments" on public.attachments;
drop policy if exists "Allow authenticated delete on attachments" on public.attachments;
drop policy if exists attachments_tenant_select on public.attachments;
drop policy if exists attachments_tenant_insert on public.attachments;
drop policy if exists attachments_tenant_update on public.attachments;
drop policy if exists attachments_tenant_delete on public.attachments;
create policy attachments_tenant_select on public.attachments for select to authenticated using (public.is_saas_admin() or firm_id = public.my_firm_id());
create policy attachments_tenant_insert on public.attachments for insert to authenticated with check (firm_id = public.my_firm_id() and public.my_role()::text in ('owner','admin','ceo','manager','accountant','billing','vault','workshop'));
create policy attachments_tenant_update on public.attachments for update to authenticated using (public.is_saas_admin() or firm_id = public.my_firm_id()) with check (public.is_saas_admin() or firm_id = public.my_firm_id());
create policy attachments_tenant_delete on public.attachments for delete to authenticated using (public.is_saas_admin() or firm_id = public.my_firm_id());
grant select, insert, update, delete on public.attachments to authenticated;
grant all on public.attachments to service_role;
