-- Audit log moves from per-device local sql.js storage to shared Supabase
-- storage — the app is online-only now, there is no local database. The
-- hash-chain (prev_hash/hash) still gives global tamper-evidence across every
-- device once seq is a single shared sequence. The HMAC signature stays
-- device-local (signed with a key that never leaves the writing device), so
-- verification of the signature itself is still scoped to the current
-- device's own entries — the app-side verifyAuditChain() only asserts
-- signature validity for entries whose device_id matches the verifying
-- device, and relies on the hash chain for cross-device tamper-evidence.
CREATE TABLE IF NOT EXISTS public.audit_log (
  seq bigserial PRIMARY KEY,
  id text UNIQUE NOT NULL,
  ts timestamptz NOT NULL DEFAULT now(),
  actor_id uuid,
  actor_email text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  before_json text,
  after_json text,
  device_id text,
  prev_hash text NOT NULL,
  hash text NOT NULL,
  signature text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_log_entity_idx ON public.audit_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS audit_log_actor_idx ON public.audit_log (actor_id);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Append-only from the app's perspective: authenticated users can insert and
-- read, nobody can update/delete (that would defeat the hash chain).
CREATE POLICY "Authenticated can read audit log"
ON public.audit_log
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated can append audit log"
ON public.audit_log
FOR INSERT
TO authenticated
WITH CHECK (true);
