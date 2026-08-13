# Architecture

AVS Gold ERP is a Supabase-online jewellery manufacturing ERP. Supabase Auth,
Postgres, RLS, RPCs, Storage, and Edge Functions are the production authority
for tenant data, roles, files, support, operations, and audit evidence.

Older offline-first and Hybrid notes are historical references only. They do
not override `docs/MASTER/ORNEXA_PRODUCT_CONSTITUTION.md` or the Product Owner
decision that production Ornexa/AVS must remain Supabase-backed.

## Runtime Layers

- `src/routes` and `src/components`: presentation, navigation, and progressive
  web-app states.
- `src/lib`: domain services, Supabase-backed stores, document/print engines,
  permissions, support, communication, and operational clients.
- `src/integrations/supabase`: generated types and Supabase client setup.
- `supabase/migrations`: authoritative database, RLS, RPC, storage, support,
  licensing, and operational-state migrations.

## Production Data Rules

| Area                      | Authority                                                    |
| ------------------------- | ------------------------------------------------------------ |
| Authentication            | Supabase Auth                                                |
| Authorization             | Supabase RLS/RBAC/RPC checks                                 |
| Tenant data               | Supabase Postgres                                            |
| Files and attachments     | Supabase Storage/signed URLs                                 |
| Support/live chat records | Supabase support tables/RPCs                                 |
| Print/document history    | Supabase operational tables                                  |
| Browser storage           | UI preference, session, draft, or retired-cache cleanup only |

There is no production Offline or Hybrid database mode. Do not add local
SQLite, IndexedDB, local-auth, local file vault, local outbox, or browser-local
business backup as an authoritative path.

Gold Vault remains a business source of truth for gold balances inside the
Supabase-backed ERP model. Gold uses integer milligrams, purity integer
per-mille, and money integer paise where applicable.
