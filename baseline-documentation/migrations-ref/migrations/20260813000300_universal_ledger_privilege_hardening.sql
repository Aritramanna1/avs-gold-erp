-- Keep universal ledger postings immutable at the table privilege layer.
-- Corrections must use reversal entries, not UPDATE/DELETE/TRUNCATE.

revoke all on public.universal_ledger_entries from authenticated;
grant select, insert on public.universal_ledger_entries to authenticated;

revoke all on public.universal_ledger_entries from anon;
