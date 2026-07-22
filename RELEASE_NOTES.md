# AVS Gold ERP Release Notes

## Version 1.1.1 — RC Refinement Release - 2026-07-22

Delivery Challan, Manufacturing Billing, and Settlement workflow completions requested for the Version 1 RC, plus a real crash fix and Supabase infra repointing.

### Fixed
- **Delivery Challan**: order selection now auto-populates customer, gross/net weight, purity, and quantity (added the missing `netMg` field). Issuing a challan posts a gold-ledger settlement so the customer's Gold Account/Manufacturing Books reflect the issued gold immediately; cancelling posts the reversal. Added the missing `delivery_challan` WhatsApp template type — this was a real type error that would have broken document sending via WhatsApp.
- **Manufacturing Billing**: applying a customer's Gold Advance previously never posted the deduction, so the balance never actually moved — fixed. A gold payment of any size was force-zeroing the invoice's remaining balance, hiding a real outstanding amount after a partial advance — fixed. Replaced `(Cr)`/`(Dr)` and "MP" jargon with plain business terms.
- **Settlement workflow**: Final Settlement now generates a Gold Settlement Voucher when the settlement included a gold payment, with its own print link on the settlement screen.
- **Billing**: Credit/Debit Notes can now be issued standalone, without requiring a linked invoice.
- **Sidebar/navigation**: Estimates, Communications/CRM, Outside Work, and Polishing gated to "Coming Soon"; renamed "Passbook Ledger" → "Gold Stock", "Ready Stock" → "Ready Stock (Coming Soon)"; Coming Soon items sorted to the bottom of the nav.
- **Runtime crash**: `manufacturing.bill.new.$jobId.tsx` used `useMemo` without importing it — real crash on that screen, fixed.
- **Infra**: `.env` was pointing the app at a Supabase project missing core tables (`orders`, `invoices`, `job_cards`, `inventory`); repointed to the fully-provisioned project, which also resolved a "table missing" error blocking all E2E seeding.
- Removed stray debug scripts from the repo root, including one with a hardcoded Supabase secret key.

### Verification
- Full Playwright E2E suite: 218/218 (all pass, or skip with a documented RC-scope reason for the intentional Coming Soon gating above).
- TypeScript: clean.

### Known open items
- WhatsApp Deep Link foreign-key error report — no reproducible stack trace obtained; every code path writing provider config was traced and none touches an FK-bearing table, so this needs a live repro to progress.
- Code-signing uses the existing dev certificate; swap in a production Authenticode cert before any public release.

## Version 1.1.0 — Final Verification Pass - 2026-07-21

Final stabilization pass before Version 1.1.0 sign-off: fixed all Critical/High Playwright E2E failures found in a full-suite run, restored dev-only diagnostic hooks dropped during the startup refactor, closed a real offline-sync outbox bug, and rebuilt the production installer.

### Fixed
- **Offline/Local First sync**: outbox entries queued while offline never drained to 0 — `pushPendingOutbox()`/`startSyncOutboxScheduler()` were unconditionally gated on Hybrid mode; both now acknowledge/schedule correctly in every deployment mode.
- **Order Timeline gaps**: gold/material issue and worker return actions never wrote an order timeline entry (`worker-issue-dialog.tsx`, `worker-return-dialog.tsx`) — both now call `appendTimeline`, matching the existing send-to-polishing pattern.
- **Print Job Queue**: `hardwareService.submitPrintJob()` generated a print-history row but discarded its own id, so callers could never correlate a print attempt with its history entry — now returns `{ jobId, status }`.
- **Print Engine content gaps**: Estimate print was missing its validity disclaimer; Worker Custody Statement's print title didn't match its own template name; both fixed.
- **Dev diagnostic hooks restored**: `window.__auditLog`/`__deviceRegistry`/`__sessionLock`/`__commQueue`/`__commService`/`__automationSettings`/`__printQueue`/`__goldRecon`/`__hardwareService` were dropped from `__root.tsx`'s DEV bootstrap during the startup-perf refactor, breaking the entire Priority 8 regression suite (audit-log tamper detection, device trust, session lock, comm retry/backoff, gold reconciliation, hardware fallback) — all restored.
- **TypeScript**: 2 `SqlValue`/`unknown` type errors in `wa-automation-store.ts`.
- **Test seed data**: `test-seed.ts` never created Debit Note / Estimate / Delivery Challan records or Worker Gold Book entries, so their Unified Print Engine migrations had nothing real to render against; also never set the live gold rate setting, so a newly-created Settlement priced at ₹0. Both fixed.
- Removed 7 obsolete "reprint is audited" E2E tests — `usePrintRecord.ts` intentionally removed reprint-audit for V1 ("printing is unlimited and unrestricted"); tests were exercising a feature this branch deliberately removed, not a regression. Skipped with the reason recorded inline rather than deleted or silently forced green.

### Known issue (not blocking, pre-existing)
- `mobile-nav-drawer.spec.ts` intermittently fails: the drawer's own nav link never reaches a stable position for Playwright's click within 25s on the 500×900 mobile viewport specifically. Reproduces consistently in isolation; needs a dedicated look at what's forcing continuous reflow in that viewport. Cosmetic (mobile drawer only), not on any money/data path.

## Version 1.1.0 (Production Release) - 2026-07-21

We are proud to announce the official production release of AVS Gold ERP Version 1.1.0. This release stabilizes all core settings modules, introduces a standalone cryptographic licensing utility, and brings extensive testing harness and database-sync stability improvements.

### Key Highlights
- **Settings & Persistence Stability**: Added missing database sync triggers and restored local cache synchronization routines across all settings modules.
- **Robust E2E Test Suite**: Fixed dynamic seed loading on localhost builds and resolved database pulls wiping out seeded data by implementing a mock database simulator inside Playwright fixtures.
- **Standalone Licensing Utility**: A clean HTML/JS cryptographic generator and renewer utilizing standard browser WebCrypto API to issue and update Ed25519-signed entitlements.
- **Vulnerability Patches**: Replaced vulnerable dependencies with secure packages, resulting in zero reported security issues.
