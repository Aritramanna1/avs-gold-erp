# Changelog

## 2026-08-27 — Master reset to GO baseline; re-apply additive Platform/MTG/995 on `main`

### Ops

- Restored Hostinger to GO zip `dist_go_20260826_190800.zip` (`index-CVsE73i6.js`).
- Canonical `main` / `origin/main` = `8dc1c43` (`stable/production-last-known-good-20260827`).
- Drift salvage: `archive/drift-platform-mtg-20260827`.
- DB audit: `docs/MASTER_RESET_DB_AUDIT_20260827.md` — no data wipe; live additive migrations kept.

### Re-applied on restored `main` (additive)

- Pure gold reference 995 + Ma Tara workshop policy / material payable.
- AVS plan × edition catalog FE + Platform Access wiring; MTG-only shell.
- Entitlement boot / route deny / Plan Builder `plan_features` sync.

## 2026-08-27 — Platform Access + MTG edition (additive on `main`)

### Added

- AVS Price Plan × Business Edition catalog: `AVS_10K_*` / `AVS_20K_*` / `AVS_30K_*` / `AVS_50K_FULL` + `AVS_MTG` with Owner-editable `price_minor` (no hardcoded ₹).
- Entitlement matrix doc: `docs/AVS_ERP_PLAN_EDITION_ENTITLEMENT_MATRIX.md`.
- Tenant boot via `get_my_tenant_entitlements` → nav filter + module_states sync + deep-link deny.
- MTG-only simple shell (`/mtg`, `MtgShell`) — other editions keep AppShell.
- Plan Builder writes `plan_features` on save; Platform AVS catalog price editor; subscription Suspend/Activate.

### Database

- `20260827020000_avs_plan_edition_catalog_mtg.sql`
- `20260827021000_entitlement_write_path_parity.sql` (RESTRICTIVE write-path policies)
- `20260827022000_entitlement_legacy_bootstrap_safe.sql` (legacy empty-features bootstrap + backfill)

### Ops

- Hostinger rollback artifact retained: `dist_go_20260826_190800.zip`.

## 2026-08-27 — Rollback economics deploy; continue on `main` only

### Ops

- Hostinger rolled back to GO zip `dist_go_20260826_190800.zip` — live `index-CVsE73i6.js`.
- Local `feat/jwelly-economics-config-spine` deleted. Working branch is **`main`** (fast-forwarded to GO freeze `8dc1c43`).
- **Owner rule:** all further work is on `main` only.

### Additive re-apply on `main` (not yet redeployed)

- `maTaraWorkshopPolicy` + `fineGoldMg` default 995; material payable flags (default PAYABLE).
- Live DB seed from earlier migration remains valid; frontend stays on GO until owner approves a `main` deploy.

## 2026-08-12 — Branch gold-rate overrides, old-gold melt-loss deduction, metal ledger indexes

### Database

- Re-verified all tables in the live Supabase project (`dqgrrafuoxaorvyrcuuh`). `gold_ledger` and `material_vault_movements` had no index covering `firm_id`, the column every RLS policy on both tables filters by — every multi-tenant read was a full table scan filtered in memory. Added composite indexes (`firm_id, ts DESC` / `firm_id, created_at DESC`) plus partial indexes on `responsible_person_id` and `branch_id` (`supabase/migrations/20260812134630_metal_ledger_missing_indexes.sql`).
- Follow-up performance-advisor scan found 11 more unindexed foreign keys on metal/vault-adjacent tables (`melt_jobs`, `precious_metal_purities`, `metal_composition_formulas`, `metal_conversions`, `customer_gold_deposits`) — all `firm_id`/`branch_id`/lookup columns. Indexed (`supabase/migrations/20260812134933_metal_ledger_fk_indexes.sql`).
- Not done: the advisor also flagged 188 RLS `auth.uid()` per-row re-evaluations and ~80 more unindexed FKs across unrelated (non-metal) tables — out of scope for this pass, needs its own review.

### Added

- Per-branch gold/silver rate overrides (`BranchSettings.goldRate24KOverridePaise` / `goldRate22KOverridePaise` / `goldRate18KOverridePaise` / `silverRateOverridePaise`, `src/lib/settings-store.ts`). Blank/unset falls back to the firm-wide rate. Editable per selected branch under Settings → Rates (only shown when more than one branch exists).
- Melt-loss deduction (%) on old-gold received on new orders (`src/routes/orders.new.tsx`) — refining/testing loss is deducted from the appraised fine weight before it's credited to the customer's account and the gold ledger. Optional, defaults to 0%, so existing behavior is unchanged when left blank.

### Fixed

- `src/lib/bullion-rate-service.ts`'s rate accessors (`useCurrentGoldRatePaise`, `useCurrentBullionRates`, `getCurrentGoldRatePaise`) — the single choke point every module is supposed to read the current rate through — now resolve the selected branch's override before falling back to the firm-wide rate, so POS billing (`BillingModule.tsx`) and everywhere else already routed through this service picks up branch overrides automatically.

## 2026-08-11 — Session and license-gate fixes

### Fixed

- Supabase auth session was persisted in `localStorage`, so a user stayed logged in after closing the browser/tab. Switched to `sessionStorage` (`src/integrations/supabase/client.ts`) — closing the tab now clears the session and the next visit requires login again.
- Expired/suspended license screen (`LicenseGate` → `LicenseBlock`) had no way out for a locked-out user. Added a "Log Out / Switch Account" button so a user blocked by an expired license can sign out and log in with a different account instead of being stuck.

### Added

- N/A this release — see Fixed above.

## 2026-07-18 — Production and licensing hardening

- Added a replaceable Arivahly Licensing Provider; customer ERP databases are never used for licensing.
- Required central license validation before Offline/Hybrid Super Owner creation.
- Added Ed25519 entitlement verification, device binding, clock-rollback detection, OS-protected cache, and edition/features/device/customer-status state.
- Hardened local sessions, password hashing/upgrade, account lockout, IPC sender/input boundaries, print-window CSP, Wasender egress, and OS-protected keys.
- Replaced vulnerable `xlsx` with lazy ExcelJS, spreadsheet formula neutralization, and safe export filenames; production dependency audit is clean.
- Improved Hybrid retry backoff, reconnect recovery, paginated pulls, and sync failure reporting.
- Removed obsolete test/seed/config/Supabase fallback implementations and hard-coded example project credentials.
- Documented the remaining automatic-DDL and Hybrid anon-RLS blockers honestly.

## [1.0.0-testing.1] — 2026-07-18

### Release preparation

- Prepared the internal Version 1 Test Release documentation set and honest readiness limitations.
- Added Electron CSP, remote-navigation blocking, safe external-link schemes, and camera-only permission scoping.
- Removed remote font requests, the development upload emulator, and the Gold Payment live compliance/debug UI.
- Corrected release-blocking TypeScript errors and completed clean renderer/Electron type-checks.
- Synchronized Offline/Hybrid documentation with SQLite-primary structured-data sync and permanent local-only file storage.

- Licensing: added configurable Trial, Active, Expired, and Suspended states across Offline, Hybrid, and Online modes, plus branded renewal/contact prompts without payments.
- Version 1 Testing Build: finalized version/publisher/installer identity, removed the Reticle debug overlay and renderer test harness, disabled Chromium developer tools and application menus, and retained the manufacturing-only pilot scope.

Release-facing changes, newest first. Keep a Changelog style. Append here on any user-visible or architecture change.

## [Unreleased]

### Added

- Operational Notifications center with unread state and actionable licensing, sync, communication, approval, and gold-rate alerts.
- Complete Catalog design workflow with configured defaults, customer provenance, encrypted references, validated weights, summary cards, and CSV export.
- Complete Catalog and Notifications dictionaries for English, Hindi, Marathi, and Bengali.
- Settings → Branding now configures runtime product identity, support details, palette, logo, print header, and reseller credit; configured values are consumed by login/setup, app chrome, About, email styling, print preview, and PDF generation.
- Settings → WhatsApp now consolidates provider/automation, secured WasenderAPI session management, and editable message templates in one tab.
- Licensing: online activation with offline grace (`license-store.ts`, `LicenseGate`, `/settings/license`) — dormant until an activation endpoint is configured; nothing hard-coded. See `docs/LICENSING.md`.
- Email documents: `sendDocumentEmail` attaches the Print Engine PDF (Resend/SendGrid attachments); `EmailPayload.attachments`.
- Automatic weekly statements (opt-in): jeweller ledger PDFs + worker verification messages, on the in-app scheduler. Toggle in Settings → WhatsApp.
- Material Vault: admin-configurable materials — add/remove persisted materials ("Manage Materials"); every material dropdown reads the store list. No hard-coded material list.
- Dashboard: WhatsApp Customer/Karigar reminders on Due Today / Due Tomorrow / Delayed / Pending buckets via the configured provider.
- Startup: authentication and shell data are prioritized; background services are staged, global overlays are lazy-loaded, duplicate cloud fetching and the development test harness are removed, and unchanged SQLite databases are no longer rebuilt and rewritten at launch.
- Hardware (Settings tab): device status matrix — Printer / Thermal Printer / Camera QR Scanner Active; Scale / Barcode Scanner / Label Printer Coming Soon.

### Changed

- Language selection now updates the document language and Settings reports honest localized coverage.
- Default Arivahly website is `https://arivahly.in/`.
- Legacy WhatsApp settings URLs now redirect to the matching `/settings?tab=whatsapp` subsection; bookmarks remain valid and no separate top-level settings surface remains.
- Universal Print Engine headers no longer invent placeholder shop names or addresses when firm data is blank; they resolve configured firm/brand values.
- Module landings set to professional **Coming Soon** (kept visible, architecture intact): Manufacturing, Barcode & Tagging, Reports, Expenses, and **Stock → Ready Stock**.
- Worker Gold Book: Daily Material Slip is the active workflow (default tab); raw Ledger/Custody tabs retired here (they live in Manufacturing Books). Outside/Polishing/Meena remain Coming Soon.
- Billing: removed "Custom Order Delivery" from the type picker (orders bill via Manufacturing Bill); "Karigar Account" → "Jeweller Account". Gold-first/cash-second confirmed.
- Settings: "WhatsApp Settings" removed from top-level nav — WhatsApp and Branding live under Settings.
- CEO Dashboard restricted to the CEO role only (hidden from super-roles too), route + nav.

### Older

- Development environment specification: `CLAUDE.md` + `docs/` (ARCHITECTURE, DATABASE, MODULES, PRINT_ENGINE, EXPORT_ENGINE, WORKFLOW_RULES, NAMING, SECURITY, CODING_STANDARDS, UI_GUIDELINES, ROADMAP, CHANGELOG).
- MCP dev servers configured (`.mcp.json`): Serena, Context7, Sequential Thinking, Filesystem, Memory, Git.
- GitFlow branch structure: `develop` + `feature/<area>` branches.
- WhatsApp document sending: `sendWhatsAppDocument` reuses the Print Engine PDF, hosts via Supabase Storage, sends through WasenderAPI. `WhatsAppDocMenu` in Orders (Customer + Karigar documents).
- Daily Material Slip migrated to the Universal Print Engine (`daily_material_slip` docType + template + builder).
- Our Gold Stock dashboard: clickable balance cards with drill-down summaries + Export/Print; "Gold With Jewellers" card.
- Material Vault: per material×purity stock items (Add/Manage Stock) with fine-gold equivalent.
- Gold ledger: additive `jeweller` bucket; movement types Purchase / Opening Stock / Closing Stock / Transfer Between Departments.

### Changed

- "Gold & Material Vault" module renamed **Our Gold Stock**; converted to overview-only (Record Movement removed).
- Balance card labels: Vault Gold → Gold Held, Finished Stock → Finished Jewellery Stock, Customer Gold Held → Advance Gold / Customer Gold Held.
- Sidebar "Worker Gold Book" → "Material Book"; in-page hub with Coming Soon books.

### Fixed

- WasenderAPI send used the wrong credential (account PAT); now uses the per-session API Key — fixes `401 Invalid API Key`.
- WasenderAPI Connect no longer 400s on an already-connected session; surfaces the API's actual error message instead of a bare status code.

## Conventions

- Sections: Added / Changed / Fixed / Removed / Security.
- One bullet per change, user-facing language. Link the module. Cut an `[Unreleased]` into a version when a build is tagged.
