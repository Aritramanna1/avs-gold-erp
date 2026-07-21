# Database

## Two tiers

1. **Local** — `sql.js` (SQLite compiled to WebAssembly), managed by `src/lib/local-db.ts`. Holds the working dataset and an **outbox** table for pending writes. This is what makes the app work with no internet.
2. **Cloud** — Supabase Postgres with Row-Level Security, Storage, and Edge Functions. Schema lives in `supabase/migrations/` (timestamp-prefixed, append-only, forward-safe, RLS-aware).

## Persistence contract

Domain records persist through **`createRepository<T>(table)`** (`src/lib/repositories/base-repository.ts`), never ad hoc Supabase calls. A repository:

- `saveLocal` / `save` — writes local first, enqueues an outbox entry, best-effort audit.
- `readAll` / `delete` / `updateLocal` — local operations.
- `sync-engine.ts` drains the outbox to Supabase; `supabase-write.ts` performs the remote upsert with branch inference.

**Never bypass the outbox** with a direct remote write. A record written straight to Supabase will not exist locally and breaks offline reads.

## Row shape

Most tables store a JSON `data` payload plus a `kind` discriminator and sync columns (`ts`, `branchId`). Example: `worker_transactions` rows carry `{ data: WorkerGoldBookEntry, kind: "gold_book_given" | "gold_book_return" }`; `gold_ledger` rows carry the `LedgerEntry` in `data`.

## Units — integers only

| Quantity | Unit | Type |
|---|---|---|
| Gold weight | milligrams (mg) | integer |
| Purity / touch | per-mille (‰), e.g. 916 = 22K | integer |
| Money | paise | integer |

Fine gold = `round(grossMg × purity ÷ 1000)`. All accounting math runs on integer mg/paise to avoid floating-point drift (`src/lib/gold.ts`). Convert to grams/rupees only at the display boundary (`mgToGrams`, `paiseToRupees`).

## Document numbering

Sequential document numbers come from **`nextDocumentNumber(scope, prefix, padWidth)`** (`src/lib/document-numbering.ts`) — e.g. `WGB-G-20260717-001`, job cards `JC-…`, daily material slips `MTS-YYYYMMDD-NNN`. The scope key isolates independent counters (per type, per day). Never generate ad hoc numbers.

## Financial locks

Postings dated inside a month-end-closed period are rejected by `assertPeriodOpen` (`financial-lock-store.ts`), gated by `workflow-engine` config `financialLockEnforcementEnabled` (default on). Applies to `gold_ledger` and `worker_transactions` writes.

## Migrations

- Location: `supabase/migrations/`, timestamp-prefixed.
- Append-only and forward-safe: never rewrite a shipped migration; add a new one.
- RLS-aware: every new table needs policies.
- Bucket creation (Storage) is done via dashboard/migration with service-role, not at runtime (`supabase-storage.ts` `ensureStorageBucketsReady` is a no-op guard).

## Storage buckets

Routed by entity type in `getBucketForEntityType` — e.g. `order-attachments`, `customer-documents`, `worker-kyc`, `firm-assets`. Generated PDFs sent over WhatsApp are uploaded here and served via short-TTL signed URLs.
