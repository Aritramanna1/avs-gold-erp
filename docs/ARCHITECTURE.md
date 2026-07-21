# Architecture

AVS Gold ERP is an **offline-first Jewellery Manufacturing ERP** — a desktop Electron app with a React renderer, a local WebAssembly SQLite database, and Supabase as the cloud system of record. It is built for gold jewellery *manufacturers* (factory gold flow, worker custody, manufacturing bills, settlements), not for retail POS.

## Process model

```
┌─────────────────────────── Electron ───────────────────────────┐
│  Main process (electron/)                                       │
│   • BrowserWindow, native menus, window-state                   │
│   • Print bridge (print:html / print:list-printers)             │
│   • WasenderAPI bridge (wasender.ts) — secrets encrypted here   │
│   • IPC channel registry (ipc-channels.ts) + preload bridge     │
│                                                                 │
│  Renderer (src/) — React 19 + Vite                              │
│   • TanStack Router (file-based) + TanStack Query               │
│   • Zustand stores (domain state, offline-first)                │
│   • Tailwind + Radix UI primitives                              │
│   • sql.js local DB + outbox  →  sync-engine  →  Supabase       │
└─────────────────────────────────────────────────────────────────┘
```

The renderer never holds a secret. The WasenderAPI Personal Access Token and session API Key live encrypted (Electron `safeStorage`) in the main process and are only decrypted for the moment of an outbound HTTPS call. See `SECURITY.md`.

## Data flow (offline-first)

1. A store method (e.g. `useLedger.append`) writes the record **locally first** via `createRepository` → `local-db.ts` (sql.js) and enqueues an **outbox** entry.
2. `sync-engine.ts` (started in `src/routes/__root.tsx`) pushes queued writes to Supabase within ~15s, on reconnect, or on next boot.
3. Reads come from local state; a background `pullBackground()` reconciles from Supabase.

No screen blocks on the network. A failed remote write is "retry later", never a crash.

## Layering

- **Routes** (`src/routes/*`) — thin. Wiring + presentation only. File-based; `routeTree.gen.ts` is generated, never hand-edited.
- **Services / stores** (`src/lib/*`) — all domain behavior. Zustand stores + pure compiler/aggregator functions.
- **Repositories** (`src/lib/repositories/base-repository.ts`, `createRepository`) — the persistence contract (local write + outbox + audit).
- **Engines** — Universal Print Engine (`src/lib/print-engine`, `src/components/print-engine`) and Universal Export Engine (`src/lib/report-engine.ts`).
- **Comm** (`src/lib/comm/*`) — provider registry, WasenderAPI client, text/document senders.

## Accounting invariant

**Gold Vault is the single source of truth.** All gold balances derive from ledger movements and reconciliation services (`ledger-store.ts` buckets, `material-vault-store.ts`, worker-book compilers). No module stores an independent mutable gold balance. Gold is integer **milligrams**, purity integer **per-mille**, money integer **paise** — never floats. See `DATABASE.md` and `WORKFLOW_RULES.md`.

## Key subsystems

| Subsystem | Entry points |
|---|---|
| Gold ledger (vault buckets) | `src/lib/ledger-store.ts`, `src/routes/ledger.tsx` (Our Gold Stock) |
| Material vault (per material×purity) | `src/lib/material-vault-store.ts`, `src/components/material-vault-panel.tsx` |
| Worker Gold Book / Material Book | `src/lib/worker-gold-book-store.ts`, `daily-material-slip.ts`, `src/routes/workshop.gold-book.tsx` |
| Manufacturing books / jeweller ledgers | `src/lib/workshop-*.ts`, `src/routes/workshop.*` |
| Orders / job cards | `src/lib/orders-store.ts`, `jobcards-store.ts` |
| Billing | `src/lib/billing-store.ts`, `billing-documents-store.ts` |
| Print | `src/lib/print-engine/*`, `src/components/print-engine/PrintEngine.tsx` |
| Export | `src/lib/report-engine.ts` |
| Communication | `src/lib/comm/*`, `electron/wasender.ts` |

## What is NOT here

- **No Express / Node HTTP server.** Cloud logic is Supabase (Postgres + RLS + Edge Functions). Context7's Express docs are reference-only; the repo has no Express service.
- No retail POS concepts (cart, tender, till).
