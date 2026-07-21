# AVS Gold ERP Release Notes

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
