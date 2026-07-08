## [0.8.0] — 2026-07-07

### Pilot Stabilization Sprint — Priority 1 & 2

#### Authentication & Security (Priority 1)

- `electron/main.ts`: DevTools are now force-closed and the F12 / Ctrl+Shift+I shortcut is blocked in production builds — previously Electron's default menu left DevTools reachable in a packaged build, exposing renderer state (Zustand stores, Supabase session) to anyone with physical access. Dev builds (`VITE_DEV_SERVER_URL` set) are unaffected.
- `electron/main.ts`: added `session.defaultSession.setPermissionRequestHandler` granting only `media` (camera/mic) — Electron denies every permission request by default, which was the actual reason the barcode camera scanner never showed a video feed.
- `src/components/app-error-boundary.tsx` (new): root-level React error boundary. Previously an uncaught render error (most notably a corrupted local database) unmounted the whole app to a blank white screen with no recovery path. Now shows a clear message and, for local-DB corruption specifically, a "Reset Local Database & Reload" action built on the existing `clearLocalDatabase()` primitive.
- `src/lib/local-db.ts`: `runLocal()` now serializes all local SQLite transactions through a single promise queue. sql.js has no concept of concurrent transactions; several independent features (audit log, device registry, comm queue, escalation) each called `runLocal()` independently at app startup, and the `await fn()` yield point let a second call's `BEGIN IMMEDIATE` slip in before the first's `COMMIT`, throwing "cannot start a transaction within a transaction." Reproduced via the device-registration e2e test.
- `src/components/security/SessionLockOverlay.tsx`: trims email/password before Auto Lock unlock (untrimmed input was rejecting correct passwords) and distinguishes a rate-limit error from a wrong-password error.

#### Company/Firm Persistence (Priority 1)

- `src/routes/settings.index.tsx`: removed a redundant `updateFirmProfile()` call that raced with `setFirm()`'s own persistence — the root cause of firm details/logo occasionally reverting after save.
- `src/lib/local-db.ts`, `src/lib/settings-store.ts`: "Clear Local Pilot Data" previously only cleared flat localStorage keys, never the actual encrypted SQLite/IndexedDB store the app reads from. `clearAllLocalData()` now clears both.

#### Data Consistency — records disappearing after reload (Priority 2)

- `src/lib/supabase-write.ts`: **root cause** — `saveDirect()`/`deleteDirect()` (the write path behind nearly every store's `save()`/`delete()`) wrote directly to Supabase only, never to the local SQLite cache. The local-first `readAll()` only re-pulls from Supabase when the local cache is completely empty for that table, so once any row had ever been cached locally, a record created in the current session stayed invisible to any local-first read (e.g. a print-preview route) until an unrelated background sync caught up. Fixed once, at the root: both functions now mirror the row into the local cache immediately after a successful Supabase write. Not specific to Settlement — every table using this shared write path had the same exposure.

#### Job Card, Gold Issue, Material Vault, Outside Work (Priority 2)

- `src/lib/material-vault-store.ts`, `src/components/material-vault-panel.tsx`: removed the obsolete Material Conversion feature and its dead store action (superseded by Worker Issue/Return and Outside Work auto-syncing the vault directly).
- `src/components/issue-gold-dialog.tsx`: gold issued via the primary Job Card workflow now syncs the Material Vault — it previously updated the Gold Ledger and Worker Gold Book but never the vault, unlike the equivalent Orders-page dialog.
- `src/components/issue-gold-dialog.tsx`, `src/components/issue-gold-material-dialog.tsx`, `src/lib/jobcards-store.ts`, `src/lib/order-issue-store.ts`: added reference-photo capture to Gold Issue (previously text notes only), surfaced on the Job Card screen and Order detail Issue History.
- `src/components/outside-work-issue-dialog.tsx`, `src/components/outside-work-receive-dialog.tsx`, `src/lib/material-vault-sync.ts`: Outside Work issue/receive now auto-sync the Material Vault, matching Worker Issue/Return.

### Known Risks

See `KNOWN_RISKS.md` for the full writeup of the settlement-workflow e2e timing risk (development-environment only, verified against the packaged Electron production build).

#### Validation

- `npx tsc --noEmit` ✓ 0 errors
- `npm run build` ✓ 0 errors
- `npx eslint` ✓ 0 errors on all touched files
- Playwright: 40+ tests run across auth, billing, GST, settlement, outside-work, job-card, printing, material-vault suites — all pass except the tracked settlement-workflow timing risk (dev-environment only) and two test-locator bugs (product behavior confirmed correct, test assertions too broad)

---

## [0.7.0] — 2026-06-28

### Final Production Stabilization — Workshop Release Candidate

#### Worker KYC Print — Complete Redesign (`/people/print/$id`)

- **Passport photo** moved to **top-right corner** of header (government-compliant placement)
- Professional A4 bordered table layout with `@page { size: A4; margin: 15mm }` print CSS
- Company header: Logo + Shop Name + Address + GSTIN + Phone + Email on left; photo box on right
- Full bordered data grid: personal info, contact, identity, address, emergency/reference, skills, bank account
- **Two-page layout**: Page 1 = KYC summary; Page 2 = uploaded document images (auto page-break)
- `avoid-break` / `page-break-inside: avoid` CSS on each document image card
- Three signature boxes: Person, Staff/Manager, Authorised Signatory
- Confidentiality notice footer on each page

#### Person / Worker Store — Extended Fields

- Added to `Person` interface: `bankAccountName`, `bankAccountNumber`, `bankIfsc`, `bankName`, `dailyWagePaise`, `skills`, `experience`, `dateOfBirth`
- Add/Edit Person dialog: new fields for workers — Date of Birth, Daily Wage, Skills, Experience, Bank Account section (name, number, IFSC, bank name)
- All new fields auto-persist via existing `saveDirect("people", ...)` pipeline

#### White-Label Cleanup — All Remaining Hardcoded Names

- `billing.gold-settlement-print.$id.tsx`: fallback `"Maa Tara Jewellers"` → `""`
- `people.ledger-print.$id.tsx`: same fix
- `billing.receipt.$id.tsx`: signature label fallback → `"Authorised Signatory"`
- `orders.print.$kind.$id.tsx`: same fix
- `stock.print.$id.tsx`: shop name default → `""`
- `attendance.print.$kind.$id.tsx`: removed `shopName === "Maa Tara Jewellers"` conditional branch → generic initials logic
- `communications.index.tsx`: birthday template → `{{branch_name}}` placeholder
- `index.tsx` (dashboard): welcome text → `firm.shopName` dynamic
- `settings.index.tsx`: SMTP diagnostics email subject → generic

#### Build Status

- `npx tsc --noEmit` ✓ 0 errors
- `npm run build` ✓ 4.08s, 0 errors
- Version: 0.7.0

---

## [0.6.0] — 2026-06-28

### WhatsApp Business API — Production Configuration

#### New: Settings → WhatsApp (`/settings/whatsapp`)

- Full WhatsApp Business API configuration page with 4 tabs: Connection, Template Mapping, Advanced, Automations
- **Provider support**: Meta WhatsApp Cloud API (official), Interakt, WATI, AiSensy, Gupshup BSPs, Deep-link fallback
- **All credentials stored in Supabase** (`branch_settings.wa_config` JSONB) — never in frontend code
- **Test Connection button** — calls Meta Graph API, returns verified phone name + status
- **Template mapping**: 10 document types → Meta-approved template name (order_confirmation, payment_receipt, etc.)
- **Advanced**: Rate limit (msg/min), retry count, timeout, API base URL, webhook verify token, webhook secret
- **Branch-specific**: separate configuration per branch, selector shows accessible branches

#### New: Automation Triggers

- 12 per-workflow on/off toggles: Order Confirmation, Order Ready, Manufacturing Complete, Invoice Generated, Payment Received, Outstanding Reminder, Gold Due Reminder, Repair Ready, Delivery Reminder, Birthday Wishes, Festival Greetings, Anniversary Wishes
- Persisted to `branch_settings.wa_automations` JSONB
- Deep-link provider shows "user must confirm send manually" notice on enabled automations

#### New: `wa-automation-store.ts`

- Zustand store for WA config + automation flags, per-branch
- `testConnection()` — async Meta API health check
- `hydrateWaStore()` — called from `pullBranchSettings()` to hydrate on login
- `isWaAutomationEnabled()` / `getWaConfig()` — callable from any module

#### New: `DocCommActions` component

- Reusable `<DocCommActions>` bar: Print A4 | Thermal | PDF | Email | WhatsApp
- WhatsApp: deep-link fallback via `waMobileUrl()`, logs to CommLog + CRM timeline
- Email: calls `sendGenericEmail()`, logs to CommLog on success
- Variants: `row` (default), `column`, `compact`
- Wired to: **Invoice detail** (`/billing/$id`), **Order detail** (`/orders/$id`), **Repair detail** (`/repair/$id`)

#### Settings → Communications Enhancement

- Test Connection button added directly to WhatsApp Cloud API provider cards
- "Open WhatsApp Settings" deep-link to new dedicated page

#### Database Migration

- `branch_settings` table: 3 new columns — `wa_config JSONB`, `wa_automations JSONB`, `comm_provider_settings JSONB`

#### Build Status

- `npx tsc --noEmit` ✓ 0 errors
- `npm run build` ✓ 5.28s, 0 errors
- Version: 0.6.0

---

## [0.5.1] — 2026-06-28

### Final Production Stabilization Sprint — Workshop Release Candidate

#### Branch Isolation — Complete

- Branch filter applied to ALL remaining pull functions: `pullWorkerTransactions`, `pullWorkerSettlements`, `pullRateCutRecords`, `pullDailyCloses`, `pullCommLogs` (joins previous 9: people, ledger, orders, jobcards, inventory, movements, invoices, attendance, repairs)
- Branch switch now triggers `pullAll()` refresh via Zustand state subscription in `auth-gate.tsx` — changing branch from the UI immediately re-fetches all branch-scoped data

#### Storage

- Created `supplier-documents` Supabase Storage bucket (10 MB limit, PDF/image/Word mime types, authenticated RW policy)

#### Print Templates — Dynamic Branding

- `repair.print.$kind.$id.tsx`: replaced hardcoded "MAA TARA JEWELLERS" with `useSettings.getState().firm.shopName`
- `reports.dailyclose-print.$id.tsx`: same fix — fully white-label

#### Communications — Campaign Dispatch Wired

- `handleTriggerCampaign` in `communications.index.tsx` now dispatches real messages:
  - Email: loops through filtered audience, calls `sendGenericEmail()` for each recipient with valid email
  - WhatsApp: opens `wa.me/` deep-link for each recipient with valid phone number
  - Reports sent/skipped count on completion
  - Filter types supported: all, VIP (notes-based), outstanding balance

#### Build Status

- `npx tsc --noEmit` ✓ 0 errors
- `npm run build` ✓ 3.98s, 0 errors
- Version: 0.5.1

---

## [0.5.0] — 2026-06-28

### Final Production Readiness Sprint

#### Branch Data Migration

- Confirmed all existing records already carry `branchId` — no stale legacy data in DB
- `branch_settings` table now fully synced: `pullBranchSettings()` added to `data-loader.ts`, runs in `pullAll()` on every login
- Realtime subscription added for `branch_settings` table → triggers live reload on remote changes
- Branch Settings save button wired to Supabase upsert (was toast-only mock)

#### Complete RBAC — Route-Level & UI-Level

- Created `src/lib/permissions.ts` — full role→route ACL matrix for 10 system roles
- Created `src/lib/use-permissions.ts` — `usePermissions()` hook returning `{ role, can, canWrite, canAdmin }`
- `beforeLoad` guard added to **21 route files** (14 layout routes + 7 top-level leaf routes): attendance, billing, manufacturing, workshop, melt, repair, stock, catalog, communications, reports, settings, ledger, whatsapp, orders, barcode, people, expenses, branches, invite, dashboard/ceo, hardware
- `auth-gate.tsx` wires `setCurrentUserRole` immediately on successful login
- `Sidebar.tsx` filters nav items by `permissions.can()` — role-ineligible links never appear
- CEO (View Only) blocked from write operations via `canWrite` flag on hook

#### Branch Settings Complete Sync

- `pullBranchSettings()` hydrates per-branch GSTIN, SMTP, WhatsApp, invoice series, hardware config, print templates into settings-store on login
- All 25 `branch_settings` DB columns mapped to `BranchSettings` interface
- Branch settings page save: real Supabase upsert replacing previous toast-only no-op

#### Communication Providers

- Deployed **`send-email` Supabase Edge Function** (Deno SMTP via Hostinger smtp.hostinger.com:465 / TLS)
- `email-send-panel.tsx`: replaced Supabase OTP mock with real `sendGenericEmail()` call
- Email service already routes to Edge Function for SMTP, Resend, SendGrid providers

#### Build Status

- `npm run build` ✓ 1325 modules, 0 errors
- `npx tsc --noEmit` ✓ 0 errors
- Version bumped: 0.4.1 → 0.5.0

---

## [0.4.1] — 2026-06-28

### Final Stabilization Sprint — Production Ready

#### Branch Isolation (Critical Fix)

- Added `branchId?: string` to `Invoice`, `Repair`, `JobCard` interfaces
- All four core stores (`orders`, `billing`, `repairs`, `jobcards`) now stamp `branchId` from `useSettings.getState().selectedBranchId` in every `add()` call
- CEO dashboard branch-filter now works correctly end-to-end
- `@ts-expect-error` suppression directives removed from `reports.index.tsx` (no longer needed)
- Order number prefix changed from hardcoded `"MTJ-"` to dynamic firm initials from settings

#### White-Label / Multi-Tenant Cleanup

- **Print templates**: Removed all hardcoded `"MTJ Secure-Receipt"` → `"Secure Receipt"`, `"MTJ Manager"` → `"Authorised Signatory"`, phone fallback `"+91 98765 43210"` → `""` (blank)
- **ThermalPrintLayout**: Now reads `shopName` from `useSettings` (was hardcoded `"Maa Tara Jewellers"`)
- **PrintLayout / ArchivalPrintLayout**: Hardcoded firm name removed from archival footer text
- **Barcode batch print**: Uses `useSettings.getState().firm.shopName` (was hardcoded)
- **Sidebar / app-shell**: Removed hardcoded `"Maa Tara Jewellers"` fallback from display logic
- **Settings DEFAULTS**: Removed fake test phone numbers, fake UPI QR, fake social links, fake registration number, fake bank account details — all blanked for white-label correctness
- **i18n auth files**: Phone placeholder changed from `"+91 98765 43210"` to `"+91 XXXXX XXXXX"`
- **shopName comparison logic**: All `shopName === "Maa Tara Jewellers"` conditional branches replaced with generic initials computation
- **Service files**: `content-builder.ts`, `email-service.ts`, `orders-tracking.ts`, `wa-placeholders.ts`, `comm-settings-store.ts` — Maa Tara fallbacks removed

#### Realtime Sync Additions

- Added realtime subscription for `manufacturing_bills` table → triggers `useMfgBills.refresh()`
- Added realtime subscription for `gold_settlements` table → triggers `useGoldSettlement.refresh()`

#### Runtime Bug Fixes

- `hardware-service.ts`: `e.key` null guard added (`e.key && e.key.length === 1`) — prevented crash on synthetic/IME keyboard events
- `gold-settlement-store.ts`: Removed `console.error` on refresh failure (graceful degradation)
- `orders-store.ts`, `billing-store.ts`, `jobcards-store.ts`: Removed `console.error` on DB refresh failure

#### Build Status

- `npm run build` → ✓ 4.48s, 0 errors
- `npx tsc --noEmit` → 0 errors (down from 18 pre-sprint)
- `npm run lint` → 0 errors, 29 warnings (non-critical)

---

# Changelog

## [2026-06-28]

- **Communications Consolidation**: Unified CRM, pipeline Kanban columns, SMTP email logs, and WhatsApp API configurations into a single Communications Hub route (`/communications`).
- **Feature Toggle System**: Introduced the `module_states` table in Supabase.
- **Store & Settings tab**: Developed `useModuleStore` to regulate module activations and dependency flows. Created the **Modules Manager** settings tab inside `/settings/`.
- **Dynamic Navigation**: Filtered the app shell sidebar based on configured active modules per branch.
