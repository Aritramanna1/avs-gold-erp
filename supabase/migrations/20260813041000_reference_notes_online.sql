-- Firm-scoped reference notes for parties, orders, and jobs.

create table if not exists public.reference_notes (
  id text primary key,
  firm_id uuid not null references public.organizations(id) on delete cascade,
  entity_type text not null check (entity_type in ('person', 'order', 'job')),
  entity_id text not null,
  note text not null,
  author text not null default 'System',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reference_notes_firm_entity_idx
  on public.reference_notes(firm_id, entity_type, entity_id, created_at desc);

alter table public.reference_notes enable row level security;

drop policy if exists reference_notes_firm_read on public.reference_notes;
create policy reference_notes_firm_read
  on public.reference_notes
  for select
  to authenticated
  using (
    firm_id in (
      select p.firm_id
      from public.user_profiles p
      where p.auth_id = auth.uid()
    )
  );

drop policy if exists reference_notes_firm_insert on public.reference_notes;
create policy reference_notes_firm_insert
  on public.reference_notes
  for insert
  to authenticated
  with check (
    firm_id in (
      select p.firm_id
      from public.user_profiles p
      where p.auth_id = auth.uid()
    )
  );

drop policy if exists reference_notes_firm_delete on public.reference_notes;
create policy reference_notes_firm_delete
  on public.reference_notes
  for delete
  to authenticated
  using (
    firm_id in (
      select p.firm_id
      from public.user_profiles p
      where p.auth_id = auth.uid()
    )
  );

grant select, insert, delete on public.reference_notes to authenticated;
