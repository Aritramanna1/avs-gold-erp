# Retired Owner-Managed Hybrid Setup

> Superseded production guidance: Ornexa / AVS production is Supabase-online only.
> Do not use this document to build, configure, sell, deploy, or justify a
> Hybrid-as-authoritative runtime. It remains only as a historical design record
> for business-rule recovery. The current authoritative architecture is
> `docs/MASTER/ORNEXA_PRODUCT_CONSTITUTION.md`, `docs/ARCHITECTURE.md`, and
> `docs/DATABASE.md`.

The design below is retired. The approved product no longer keeps SQLite as the
primary operational database, no longer uses a local file vault as production
authority, and does not ask a tenant owner to configure Hybrid runtime keys.
Supabase Auth, Supabase PostgreSQL, Supabase RLS, and approved
Supabase-compatible storage/services are authoritative.

## Retired setup workflow, preserved for history only

The following Version 1 Hybrid sequence is not approved for current production
or new pilots. It is kept only so older test evidence can be interpreted:

1. Arivahly validated the customer license through the Central Licensing API.
2. A dedicated Supabase project was created for the customer.
3. The legacy master SQL was applied manually by the owner/operator.
4. The retired client accepted License Key, Project URL, Anon Key, and a setup-only Service Role Key.
5. Electron validated service-key access and schema version, then discarded the Service Role Key.
6. A permanent local Super Owner was created for the local-first runtime.

## Automatic initialization constraint

The Supabase service-role key authorizes Auth/Data APIs but does not provide an arbitrary PostgreSQL DDL endpoint. Therefore those four setup values alone cannot safely install a completely fresh schema. Automatic master-migration execution requires a separate authenticated Arivahly provisioning/SQL service or a database connection credential; neither exists in the approved Version 1 architecture. The application does not request database passwords and does not pretend initialization succeeded.

Until a provisioning mechanism is approved, master SQL remains owner-applied and the ERP performs end-to-end validation and schema-version recording.

## Synchronization and recovery

- Retired local writes entered a durable SQLite outbox.
- Retries use capped exponential backoff with jitter and run immediately after reconnection.
- Pulls are paginated and use a high-water mark so large datasets and mid-pull updates are recoverable.
- Conflicts are recorded for explicit resolution and never silently overwrite local data.
- Logos, photos, KYC, jewellery/job images, PDFs, reports, exports, barcodes, attachments, and backups remain local permanently.

## Security acceptance blocker

The current master migration enables broad Data API access for the dedicated project's anon role. This supports the present local-auth sync implementation but is not an acceptable production trust boundary because an anon key is extractable from a desktop client. Before paying-customer Hybrid deployment, create a dedicated authenticated sync principal and replace broad anon policies with authenticated, restrictive RLS. Offline mode is unaffected.
