# AVS Gold ERP — Demo RC1 Release Notes

**Version:** 1.1.0-demo-rc1
**Build date:** 2026-07-11
**Purpose:** Client demonstration build. This is a stabilization release, not Version 1.1 Final — no new features, no workflow changes, no business-rule changes this cycle.

## What this build is

A feature-frozen snapshot of AVS Gold ERP verified for a live client demo: sign-in, customer/KYC management, order creation with automatic job card generation and karigar assignment, workshop tracking, worker gold book, inventory, billing/invoicing, reports, and settings all confirmed working end-to-end with no crashes, white screens, or broken navigation.

## What changed since the last build (v1.1.0, 2026-07-09)

- Print Engine: fixed infinite print-preview loading for two document types (karigar custody statement, customer ledger statement), missing firm logo on exported PDFs, and orientation/margin settings not reaching the native Electron print path.
- This session: full pre-export verification (TypeScript, ESLint, production build, Electron build) and a manual smoke test across every primary module — no defects found, no code changes were needed.

## What to expect during the demo

- The new Print Engine is live for 5 of ~15 document types (invoice, credit note, debit note, estimate, delivery challan, plus two ledger/statement reports). Everything else prints through the prior, fully working print system. Both are stable — this is a rollout-in-progress, not a gap.
- A fresh install shows "Gold Rate Not Set" until an operator enters the day's rate — expected first-run behavior, takes seconds to configure.
- See `KNOWN_ISSUES.md` for the complete list of intentionally deferred items.

## Verification performed

- `npx tsc --noEmit` — 0 errors
- `eslint .` — 0 errors (36 pre-existing style warnings, unchanged)
- `npm run build` — clean production build
- `npm run build:electron` — clean Electron compile
- Manual walkthrough: Login → Customer → Order → Job Card → Workshop → Worker Gold Book → Inventory → Billing → Reports → Settings → Logout — completed without a single crash, white screen, or broken dialog.
