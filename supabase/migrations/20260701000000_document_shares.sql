-- Customer document share links table
-- Snapshots both the document and firm profile at share time so the portal
-- works without any ERP authentication.

CREATE TABLE IF NOT EXISTS document_shares (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type    TEXT NOT NULL,
  document_id      TEXT NOT NULL,
  firm_snapshot    JSONB NOT NULL DEFAULT '{}',
  document_snapshot JSONB NOT NULL DEFAULT '{}',
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  branch_id   TEXT
);

CREATE INDEX IF NOT EXISTS document_shares_expires_at_idx ON document_shares (expires_at);
CREATE INDEX IF NOT EXISTS document_shares_document_id_idx ON document_shares (document_id);

ALTER TABLE document_shares ENABLE ROW LEVEL SECURITY;

-- Anyone (including anon) can read non-expired share records by their UUID token.
CREATE POLICY "public_read_non_expired"
  ON document_shares FOR SELECT
  USING (expires_at > now());

-- Only authenticated users can create share links.
CREATE POLICY "authenticated_insert"
  ON document_shares FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Owners can delete their own shares (revoke access).
CREATE POLICY "owner_delete"
  ON document_shares FOR DELETE
  USING (created_by = auth.uid() OR created_by IS NULL);
