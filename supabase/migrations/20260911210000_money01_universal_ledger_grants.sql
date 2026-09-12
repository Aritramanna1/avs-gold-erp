-- MONEY-01: vouchers hydrate failed with PostgREST 42501
-- "permission denied for table universal_ledger_entries"
-- Captured 2026-09-11 via REST probe (anon). Authenticated Owner 777 saw
-- UI "Failed to load money vouchers" while COA Cash/Bank loaded.
-- Re-assert grants + read policies used by money-voucher hydrate.

revoke all on table public.universal_ledger_entries from anon;
revoke all on table public.universal_transaction_definitions from anon;

grant select, insert on table public.universal_ledger_entries to authenticated;
grant select on table public.universal_transaction_definitions to authenticated;

alter table public.universal_ledger_entries enable row level security;
alter table public.universal_transaction_definitions enable row level security;

drop policy if exists universal_ledger_entries_read on public.universal_ledger_entries;
create policy universal_ledger_entries_read on public.universal_ledger_entries
for select to authenticated
using (firm_id = public.my_firm_id() or public.is_saas_admin());

drop policy if exists universal_ledger_entries_insert on public.universal_ledger_entries;
create policy universal_ledger_entries_insert on public.universal_ledger_entries
for insert to authenticated
with check (firm_id = public.my_firm_id() or public.is_saas_admin());

drop policy if exists universal_transaction_definitions_read on public.universal_transaction_definitions;
create policy universal_transaction_definitions_read on public.universal_transaction_definitions
for select to authenticated
using (
  coalesce(is_system, false)
  or firm_id = public.my_firm_id()
  or public.is_saas_admin()
);
