# Owner-Managed Hybrid Setup

Hybrid keeps SQLite as the primary operational database and every file in the local vault. Supabase stores structured business records only. Supabase Storage is never used.

## Current secure setup workflow

1. Arivahly validates the customer license through the Central Licensing API.
2. Create a dedicated Supabase project for the customer.
3. Run [`supabase/AVS_GOLD_ERP_HYBRID_MASTER.sql`](../supabase/AVS_GOLD_ERP_HYBRID_MASTER.sql) in that project's SQL Editor.
4. Choose **Hybrid** and enter License Key, Project URL, Anon Key, and the setup-only Service Role Key.
5. Electron validates the service key, anon access, and `erp_schema_meta.schema_version`. The Service Role Key is discarded immediately. Runtime retains only Project URL and Anon Key.
6. Create the permanent local Super Owner. Local operation continues if the network later fails.

## Automatic initialization constraint

The Supabase service-role key authorizes Auth/Data APIs but does not provide an arbitrary PostgreSQL DDL endpoint. Therefore those four setup values alone cannot safely install a completely fresh schema. Automatic master-migration execution requires a separate authenticated Arivahly provisioning/SQL service or a database connection credential; neither exists in the approved Version 1 architecture. The application does not request database passwords and does not pretend initialization succeeded.

Until a provisioning mechanism is approved, master SQL remains owner-applied and the ERP performs end-to-end validation and schema-version recording.

## Synchronization and recovery

- Local writes enter the durable SQLite outbox.
- Retries use capped exponential backoff with jitter and run immediately after reconnection.
- Pulls are paginated and use a high-water mark so large datasets and mid-pull updates are recoverable.
- Conflicts are recorded for explicit resolution and never silently overwrite local data.
- Logos, photos, KYC, jewellery/job images, PDFs, reports, exports, barcodes, attachments, and backups remain local permanently.

## Security acceptance blocker

The current master migration enables broad Data API access for the dedicated project's anon role. This supports the present local-auth sync implementation but is not an acceptable production trust boundary because an anon key is extractable from a desktop client. Before paying-customer Hybrid deployment, create a dedicated authenticated sync principal and replace broad anon policies with authenticated, restrictive RLS. Offline mode is unaffected.
