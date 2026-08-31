-- Harden document shares: public access must go through the token resolver.
-- Direct anon SELECT would expose every non-expired document snapshot.
begin;

drop policy if exists "public_read_non_expired" on public.document_shares;

drop policy if exists "authenticated_insert" on public.document_shares;
create policy "authenticated_insert_own" on public.document_shares
  for insert to authenticated
  with check (created_by = (select auth.uid()));

revoke select on public.document_shares from anon, authenticated;
grant insert on public.document_shares to authenticated;

commit;
