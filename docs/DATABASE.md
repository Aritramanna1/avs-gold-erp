# Database Guide

## Web database

Supabase PostgreSQL is the single source of truth. The browser uses Supabase Auth for sessions and cloud-backed repositories/services for business data. There is no local database, offline sync queue, or desktop persistence layer.

Gold is stored in integer milligrams, purity in integer per-mille, and money in integer paise.

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
