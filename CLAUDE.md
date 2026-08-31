# AVS Gold ERP / Ornexa

Read this file and the authoritative documents in `docs/` and `docs/MASTER/` before changing code.

## Product

AVS Gold ERP / Ornexa is a Supabase-online jewellery manufacturing ERP for web, desktop, and mobile surfaces. It handles factory gold, worker issue and return, manufacturing, stock, orders, billing, reporting, print, export, communication, and licensing. It is not a retail jewellery POS.

Gold Vault remains the accounting source of truth. Gold balances derive from approved vault and ledger flows inside the Supabase-backed ERP; do not create independent mutable balance fields or local-authoritative copies.

## Stack and runtime

- Browser web app: React 19 + TypeScript + Vite, TanStack Router/Query, Zustand, Tailwind, Radix UI.
- Production authority: Supabase Auth, PostgreSQL, RLS, RPCs, Storage, and approved cloud services.
- Runtime principle: all production operations must use the same authenticated Supabase-backed data plane across Web, Desktop, Mobile, and portal clients.
- Retired legacy paths: local SQLite, local-first sync, IndexedDB primary persistence, local auth, dual-database execution, and hybrid-as-authoritative runtime logic are not authorized in production.
- Universal Print Engine and Universal Export Engine remain the supported document/report pipelines.

## Required reading

Read the current authoritative documents before implementation, especially:

- `docs/ARCHITECTURE.md`
- `docs/DATABASE_AND_SUPABASE_MASTER.md`
- `docs/MASTER/ORNEXA_PRODUCT_CONSTITUTION.md`
- `docs/MASTER/FINAL_ERP_COMPLETION_GOAL.md`
- `docs/MASTER/ORNEXA_DECISION_LOG.md`
- `docs/MASTER/SUPABASE_EGRESS_ENGINEERING_RULES.md` (mandatory request-efficiency rules)

## Architecture rules

- Inspect existing components, stores, services, utilities, and routes first. Reuse and extend them.
- Keep routes thin. Put domain behavior in the existing `src/lib` services and state stores.
- Use the Supabase-backed data provider and RBAC/RLS patterns. Never add local-authoritative database logic.
- Store gold as integer milligrams, purity as integer per-mille, and money as integer paise. Never use floats for accounting.
- Migrations live under `supabase/migrations/` and must be append-only, forward-safe, and RLS-aware.
- Use the universal print/export engines. Do not add a parallel local printing or export stack.
- WasenderAPI and communication secrets remain in the approved secure cloud/runtime configuration path. Renderer code never reads secrets.
- Branding, configuration, and tenant behavior live under the approved Settings and Customization surfaces, not in parallel local-only configuration.

## Engineering rules

- Strict TypeScript, named domain types, boundary validation. Avoid new `any` unless a justified migration case is documented.
- Do not reintroduce offline or hybrid business-state architecture.
- For non-trivial logic, add focused verification and validate the app with the required TypeScript and build checks.
- Never edit generated `src/routeTree.gen.ts` manually.
- Update canonical docs and changelog entries when architecture or workflow behavior changes.
- GitFlow: branch from the active development branch and avoid rewriting published history.

## Planning and tools

- Serena: symbol lookup, references, semantic search, incremental indexing.
- Context7: current React, TypeScript, Vite, and Supabase guidance.
- Sequential Thinking: use for complex multi-module implementation planning.
- Native Git CLI: manage git history and state responsibly.
