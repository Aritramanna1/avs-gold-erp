-- SECURITY FIX: document_sequences still carried the "Allow public sequence
-- modification" policy from 20260625130000_setup_atomic_sequence_numbering.sql
-- (FOR ALL TO public USING (true) WITH CHECK (true)) — granting the
-- unauthenticated anon role full read/write/delete on invoice/order/job-card
-- sequence counters via the REST API using nothing but the public anon key.
--
-- 20260627120000_multi_branch_and_comm_providers.sql added a branch_id
-- column to this table and intended to replace every listed table's ad-hoc
-- policies with a single branch-isolation policy, but document_sequences was
-- present in that migration's "add branch_id" table array while missing from
-- its separate "apply branch_isolation policy" table array — so the old
-- public-access policy was never dropped. This migration only removes that
-- gap; it does not change behaviour for any authenticated user.
DROP POLICY IF EXISTS "Allow public sequence modification" ON public.document_sequences;

-- Keep sequence generation working for every authenticated user (matches the
-- existing "Allow authenticated sequence modification" policy already in
-- place) — no behavioural change for the app itself, since every real caller
-- of next_document_number()/generate_sequential_number() is already an
-- authenticated session.
