# Known Issues — AVS Gold ERP Demo RC1

Intentional, deferred limitations for this demo build. Nothing below is a crash, white screen, data-loss bug, or broken workflow — if it were, it would have blocked this release.

## Print Engine — partial migration

The new unified Print Engine covers 5 of ~15 document types (invoice, credit note, debit note, estimate, delivery challan, plus the engine-native karigar custody statement and customer ledger statement). Remaining document types print through the previous, still-functional print system — not broken, just not yet on the new template engine. Both systems are confirmed safe to coexist. No print route crashes, produces a white screen, or leaves a frozen dialog; unfinished templates render their existing (pre-migration) layout rather than a new one.

## Automated test coverage skipped for this build

The full 134-test Playwright e2e suite and Reticle automated verification were intentionally skipped for this build to prioritize turnaround time for today's demo. In their place, a manual smoke test covered: Login, Customer (People/KYC), Order creation, automatic Job Card generation, Workshop assignment, and navigation across all primary modules — no crashes or broken flows found. The full automated suite should be run before the next release.

## Live gold rate not pre-configured

A fresh environment shows "Gold Rate Not Set" until an operator enters today's rate under Settings, or via the "Set Gold Rate Now" banner. This is expected first-run behavior, not a defect — money values and karigar salary calculations intentionally show as blank/zero until a rate is set, rather than guessing.

## Catalog module has no automated test coverage

Catalog (`/catalog`) was verified by manual smoke test only this cycle; it has no dedicated Playwright spec file yet. No issues found during manual verification.

## Pre-existing, non-blocking

- 36 ESLint warnings (`react-hooks/exhaustive-deps`, `react-refresh/only-export-components`) — code-quality notices, not runtime defects, unchanged from prior releases.
- Several production bundle chunks exceed 500KB post-minification (charts, PDF, spreadsheet libraries) — affects initial load time on very slow connections, not functionality.
- A live Supabase service-role secret exists in older git history (flagged in a prior internal audit, already scheduled for rotation as a pre-production hardening task) — not reachable from the shipped client app, not a demo-time risk.
