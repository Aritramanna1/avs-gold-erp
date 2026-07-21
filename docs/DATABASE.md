# Database Guide

## Local database

`src/lib/local-db.ts` runs SQLite through `sql.js`. The encrypted database snapshot is persisted in IndexedDB with AES-256-GCM and a SHA-256 plaintext integrity checksum. SQLite is primary in Offline and Hybrid modes.

Domain writes go through repositories/services, commit locally, and enqueue an outbox row. Do not add frontend direct-Supabase writes. Gold is stored in integer milligrams, purity in integer per-mille, and money in integer paise.

## Hybrid database

Supabase stores structured business records only. The canonical new-customer schema is [AVS_GOLD_ERP_HYBRID_MASTER.sql](../supabase/AVS_GOLD_ERP_HYBRID_MASTER.sql). It contains tables, constraints, indexes, functions, metadata, explicit Data API grants, RLS, and policies.

Owner setup:

1. Create a separate Supabase project for the customer.
2. Run the complete master SQL in Supabase SQL Editor.
3. In ERP Hybrid setup, enter Project URL, anon key, and the setup-only service-role key.
4. Allow validation to check the setup guard/schema. The service-role key is discarded and never stored.
5. Confirm an initial sync and inspect unresolved conflicts before normal use.

Supabase Storage is never used. Logos, photos, KYC files, attachments, reports, PDFs, exports, barcodes, and backups remain local and are excluded from synchronization.

## Backup and migration rules

- Back up before mode changes, imports, restoration, or upgrades.
- Never delete the local database after enabling Hybrid.
- Preserve stable record IDs and `updated_at` values.
- Update the master SQL whenever a synchronized local table or mapping changes.
- Test schema changes against a disposable fresh Supabase project before customer rollout.
