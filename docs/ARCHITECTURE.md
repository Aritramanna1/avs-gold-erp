# Architecture

AVS Gold ERP is an offline-first jewellery manufacturing desktop ERP. Electron hosts a sandboxed React renderer. WebAssembly SQLite is the primary operational database; Hybrid mode optionally synchronizes structured records to an owner-managed Supabase Postgres project. Files remain local in every supported Version 1 mode. This is not a retail POS.

## Runtime layers

- `electron/`: BrowserWindow, safe credential storage, native dialogs/notifications, printing, and the typed preload IPC bridge.
- `src/routes` and `src/components`: presentation and navigation.
- `src/lib`: domain stores/services, authentication, permissions, providers, synchronization, print/export engines, and local persistence.
- `src/lib/repositories/base-repository.ts`: local-first persistence contract.
- `src/lib/providers/runtime-providers.ts`: database, storage, authentication, and synchronization provider selection.

## Deployment modes

| Mode    | Database                                  | Files                   | Authentication          | Synchronization           |
| ------- | ----------------------------------------- | ----------------------- | ----------------------- | ------------------------- |
| Offline | SQLite                                    | Local only              | Local                   | Disabled                  |
| Hybrid  | SQLite primary + Supabase structured data | Local only              | Local/current provider  | Queued Supabase data sync |
| Online  | Future managed provider                   | Local by current policy | Future managed provider | Not Version 1 ready       |

Local writes commit first and enter the SQLite outbox. In Hybrid mode, the sync engine retries queued rows, pulls incremental remote changes, records conflicts, and preserves local data through network loss. File/blob tables are explicitly excluded.

Gold Vault is the single source of truth. Gold uses integer milligrams, purity integer per-mille, and money integer paise. Printable documents use the Universal Print Engine; exports use the Universal Export Engine.

Settings owns runtime branding, operational defaults, providers, hardware, WhatsApp, licensing UI, backup/recovery, and permissions-facing configuration. The frontend must use existing services/providers and must never select Supabase directly.
