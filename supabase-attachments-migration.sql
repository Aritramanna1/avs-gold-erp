-- Corrected Supabase Migration File for Attachments Table
-- File: supabase-attachments-migration.sql
-- Create attachments table to log file links stored physically on Hostinger with Row Level Security (RLS)

create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  storage_provider text not null default 'hostinger',
  file_path text not null,
  file_url text not null,
  file_name text not null,
  original_file_name text,
  mime_type text,
  file_size bigint,
  related_module text not null, -- 'firm-logos', 'expense-attachments', 'kyc-documents', etc.
  related_table text not null,  -- target table name (e.g. 'orders', 'people', 'expenses')
  related_record_id uuid null,   -- UUID link in the target table
  branch_id uuid null,          -- link to branch if applicable
  uploaded_by uuid null references auth.users(id),
  uploaded_at timestamptz not null default now(),
  is_deleted boolean not null default false,
  deleted_at timestamptz null,
  notes text null,
  data jsonb not null default '{}'::jsonb
);

-- Indexing for fast query speeds
create index if not exists idx_attachments_related
on public.attachments (related_table, related_record_id);

create index if not exists idx_attachments_module
on public.attachments (related_module);

create index if not exists idx_attachments_uploaded_by
on public.attachments (uploaded_by);

-- Enable Row Level Security (RLS)
alter table public.attachments enable row level security;

-- Setup secure policies (Authenticated users only)
drop policy if exists "attachments_select_authenticated" on public.attachments;
create policy "attachments_select_authenticated"
on public.attachments
for select
to authenticated
using (is_deleted = false);

drop policy if exists "attachments_insert_authenticated" on public.attachments;
create policy "attachments_insert_authenticated"
on public.attachments
for insert
to authenticated
with check (auth.uid() = uploaded_by);

drop policy if exists "attachments_soft_update_own" on public.attachments;
create policy "attachments_soft_update_own"
on public.attachments
for update
to authenticated
using (auth.uid() = uploaded_by)
with check (auth.uid() = uploaded_by);

-- Grant appropriate permissions
grant select, insert, update on public.attachments to authenticated;
grant all on public.attachments to service_role;
