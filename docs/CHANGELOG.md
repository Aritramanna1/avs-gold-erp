# Changelog

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
