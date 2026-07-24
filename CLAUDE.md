# AVS Gold ERP Development Guide

Read this file and every required document in `docs/` before changing code.

## Product

AVS Gold ERP is an offline-first Jewellery Manufacturing ERP. It handles factory gold, worker issue and return, manufacturing, stock, orders, billing, reporting, print, export, and communication. It is not a retail jewellery POS.

Gold Vault is the accounting source of truth. Gold balances derive from vault movements and reconciliation services; do not create independent balance calculations or mutable balance fields.

## Stack And Runtime

- Browser web app (Electron removed 2026-07-24): React 19 + TypeScript + Vite, TanStack Router/Query, Zustand, Tailwind, Radix UI.
- Three runtime modes via `src/lib/deployment-mode.ts` / `src/lib/providers/data-provider.ts`: `offline` (local sql.js only), `hybrid` (sql.js primary + Supabase sync), `online` (Supabase-managed, no local DB). The web build (`maatarajewellers.shop`) sets `VITE_DEFAULT_DEPLOYMENT_MODE=online` — always import data access through `src/lib/providers/data-provider.ts`, never the raw Supabase client, so this stays swappable.
- Local database (offline/hybrid modes only): `sql.js`, a SQLite-compatible WebAssembly database, with an outbox for offline writes.
- Remote persistence: Supabase Postgres, RLS, Storage, Edge Functions. There is no Express server in this repository.
- Universal Print Engine: `src/lib/print-engine/` plus `src/components/print-engine/`; all printable documents use it.
- Universal Export Engine: `src/lib/report-engine.ts`; all CSV/XLSX exports use it.

## Required Reading

Read relevant documents: `docs/ARCHITECTURE.md`, `DATABASE.md`, `MODULES.md`, `PRINT_ENGINE.md`, `EXPORT_ENGINE.md`, `SETTINGS.md`, `WHATSAPP.md`, `LICENSING.md`, `WORKFLOW_RULES.md`, `NAMING.md`, `SECURITY.md`, `CODING_STANDARDS.md`, `UI_GUIDELINES.md`, `ROADMAP.md`, `CHANGELOG.md`.

## Architecture Rules

- Inspect existing components, stores, services, utilities, routes first. Reuse them.
- Keep routes thin. Put domain behavior in existing `src/lib` services/stores. Use `createRepository` for persisted domain records where its contract fits.
- Use `src/lib/local-db.ts`, `sync-engine.ts`, `supabase-write.ts` for offline persistence/sync. Never bypass outbox with ad hoc remote writes.
- Store gold as integer milligrams, purity as integer per-mille, money as integer paise. Never use floats for accounting.
- Migrations: `supabase/migrations/`, timestamp-prefixed, append-only, forward-safe, RLS-aware.
- Use universal print/export engines. Do not call `window.print`, add a parallel PDF pipeline, or build another CSV/XLSX utility.
- WasenderAPI uses `src/lib/comm` providers only. Renderer code never reads secrets.
- Branding and WhatsApp configuration live under `/settings`; keep runtime identity, provider behavior, templates, retries, and automation configurable through the established stores. Do not add parallel settings pages or top-level settings navigation.

## Engineering Rules

- Strict TypeScript, named domain types, boundary validation. No new `any`.
- Follow `docs/NAMING.md`, `CODING_STANDARDS.md`, `UI_GUIDELINES.md`.
- Add focused tests or runnable self-check for non-trivial logic. Never run Playwright.
- Never edit generated `src/routeTree.gen.ts` manually.
- Always run `npm run dev` and check the app in a browser after implementation for manual verification.
- Update documents with architecture/schema/module/print/export/workflow changes. Append release-facing changes to `docs/CHANGELOG.md`.
- GitFlow: branch from `develop`, use `feature/<area>-<summary>`, review before merge. Never force-push, rebase, amend, or squash already-pushed Lovable history.

## Planning And Tools

- Serena: symbol lookup, references, semantic search, incremental indexing.
- Context7: current React, Electron, TypeScript, Node.js, SQLite, Express, Vite docs.
- Sequential Thinking: complex, multi-module planning before implementation.
- Native Git CLI: Git history/state. Project memory: durable decisions only; never credentials/customer data.
