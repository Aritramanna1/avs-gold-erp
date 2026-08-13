# Database Guide

## Production Database

Supabase Postgres is the production database for Ornexa / AVS Gold ERP.
Supabase Auth identities, tenant profiles, roles, branches, transactions,
documents, support, communication, operational state, and audit records must be
stored and protected through Supabase-backed tables, RPCs, RLS, and storage
policies.

The retired browser-local SQLite/IndexedDB database and Hybrid sync model are
not production architecture. Any older SQL or docs that mention Offline or
Hybrid mode are legacy references for business-rule recovery only.

## Rules

- Keep RLS enabled on every exposed public table.
- Do not expose service-role keys, database passwords, private signing keys, or
  privileged API secrets to the browser.
- Do not add browser-local business backup/import/restore workflows.
- Do not add local SQLite/IndexedDB/local-file-vault authoritative storage.
- Prefer tenant-scoped Supabase services, typed stores, and audited RPCs for
  business writes.
- Use migrations under `supabase/migrations` for database changes and record
  evidence in the master docs.

## Backup And Recovery

Production backup/restore is a Supabase-controlled operational workflow. Local
browser cache cleanup is not a data restore path and must not be presented to
users as a business backup.
