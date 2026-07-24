# Electron → Browser Migration Notes (2026-07-24)

## What changed

- Branched from `c35f4b3` (2026-07-22, v1.1.1 — last commit before an earlier,
  now-abandoned full-rewrite attempt on `feature/workshop-v1-stabilization`).
  New branch: `erp-v1-electron-dev`.
- Removed `electron/` (main, preload, ipc-channels, secure-store, wasender,
  window-state, error-handling), `dist-electron/`, and all
  `electron`/`electron-builder`/`@electron/rebuild` dependencies and npm
  scripts. The app had zero `ipcRenderer`/`electronAPI` references in `src/`
  before removal — Electron was a packaging wrapper, not a runtime dependency.
- Set `VITE_DEFAULT_DEPLOYMENT_MODE=online` for the web build. This repo
  already had a three-mode runtime (`offline` / `hybrid` / `online` — see
  `src/lib/deployment-mode.ts`); `online` mode was fully implemented
  (Supabase-managed auth + database, no `sql.js`) and just needed to be
  selected as the default for a browser deployment.
- Added `AddType application/wasm .wasm` to `public/.htaccess` — Hostinger's
  Apache was serving the `sql.js` WASM binary with the wrong MIME type,
  breaking `WebAssembly.compileStreaming` (fell back to slower ArrayBuffer
  instantiation; non-fatal, but fixed).
- Applied one additive Supabase migration to project `kjfjsfhftytezsjyegmb`
  (`20260724150000_add_missing_web_tables_and_columns.sql`) to bring an
  independently-migrated Supabase project in line with what this codebase's
  data layer expects. Regenerated `src/integrations/supabase/types.ts` from
  the live schema.

## Why `online` mode instead of a data-layer rewrite

The codebase already isolates persistence behind
`src/lib/providers/data-provider.ts` — UI/stores never import the Supabase
client directly, they go through `dataProvider`, which resolves to the
correct backend for the active mode. Flipping the build-time default to
`online` gets a pure-Supabase, no-`sql.js` runtime without touching business
logic. `offline`/`hybrid` modes (and their `sql.js` code) are untouched in
the codebase — a future Electron/desktop build can still opt into them via
`VITE_DEPLOYMENT_MODES_ENABLED=true` without another rewrite.

## Known limitations

- `getDeploymentMode()` calls `initLocalDb()` unconditionally (even in
  `online` mode) because the deployment-mode flag itself is read from
  `sql.js`'s meta table before the mode is known. This means a small
  `sql.js` WASM payload still loads on first paint even for the pure-web
  build. Non-fatal, small, but worth revisiting if a lighter no-`sql.js`
  bundle is wanted later.
- RLS/SECURITY DEFINER hardening on `kjfjsfhftytezsjyegmb` (31
  `USING(true)` policies, public/anon EXECUTE on 14 SECURITY DEFINER
  functions including the gold-ledger `execute_gold_transaction`) is
  **not yet applied** — the GRANT/REVOKE statements were blocked by the
  session's permission classifier as a live-production privilege change
  and need explicit approval to run.
- Full manual end-to-end verification (every module: orders, workshop,
  billing, inventory, reports, printing, barcode, permissions) has not
  been performed — build/typecheck/lint are clean and the login screen is
  confirmed to route through Supabase auth, but per-module functional
  testing against real data is still open.
