# MASTER GAP REGISTER — AVS Gold ERP / Ornexa

**Date:** 2026-08-30  
**Sources:** `_reconstruction/ALIGNMENT_PROGRESS.md`, `FUNCTIONAL_PARITY_REPORT.md`, `A-Z_PARITY_STATUS.md`, `docs/CODE_LEVEL_VERIFICATION_REGISTER.md`, `docs/IMPLEMENTATION_MATRIX.md`, `docs/AVS_ERP_PRODUCT_EDITION_PLANNING_REFERENCE.md`  
**Overall verdict:** **NOT PASS** — dashboard KPI + delayed-order parity achieved; portals/KYC/migrations/customization/print chains open

---

## Side-by-side dashboard (2026-08-30 continuation)

| Metric | Frozen (:3002) | Editable (:3000) | Status |
|--------|----------------|------------------|--------|
| Vault / Karigar / Open orders / Stock / Billing | Match | Match | ✅ VERIFIED live |
| **Delayed orders badge** | **412** | **412** (after abort-signal + bucket fetch fix) | ✅ VERIFIED live |

**Root cause (delayed):** React StrictMode/route cleanup aborted `fetchOrderBucketsOnly` while KPI RPC completed; store re-merge also overwrote buckets with 120-row cache. Fixed in `home-dashboard-query.ts` + `app.tsx` + `orders-store.ts`.

---

## Rule (non-negotiable)

**Route / HTTP 200 / typecheck / build pass ≠ verified completion.**

A module is **VERIFIED** only when the full chain works with real data: UI → validation → store → Supabase/RPC → DB → calculation → ledger/stock → report → print/PDF → share (where applicable).

---

## Public signup removal (2026-08-30)

**Status: IMPLEMENTED (editable source + migration applied on linked project)**

- Public `/trial/start` self-signup **removed** — redirects to `/request-access`
- RPC `provision_public_trial` **revoked/blocked**; edge `public-trial-provision` returns **403**
- Invitation-only path preserved: `/invite/accept` + `invite-accept` edge (rate-limited)
- Platform owner `onboard-tenant` unchanged (admin-only tenant creation)
- Evidence: `docs/SIGNUP_RESTRICTION_IMPLEMENTATION.md`, `qa/unit/invitation-only-signup.test.ts`

---

## P0 module gap matrix

| Module | UI | Store | Supabase | Calc | Print/PDF | Share | Status | Priority |
|--------|:--:|:-----:|:--------:|:----:|:---------:|:-----:|--------|:--------:|
| **Billing (create / edit / post)** | YES | YES | PARTIAL | PARTIAL | PARTIAL | PARTIAL | PARTIAL — print/PDF chain fixed: `rowToInvoice` preserves verification tokens; `ensureBillingInvoiceForPrint` hydrates + mints before print/PDF; cancel revokes verification | P0 |
| **Billing verification QR (`/verify`)** | YES | YES | YES | — | PARTIAL | PARTIAL | PARTIAL — QR token flows through print data → PrintQR; cancel revokes; live mint→scan needs owner QA | P0 |
| **Bank Reconciliation** | YES | YES | YES | YES | PARTIAL | NO | PARTIAL — CSV import + auto-match + `postBankChargeVoucher` wired; migration applied; live charge posting needs owner QA | P0 |
| **Data-loader (boot sync)** | YES | YES | PARTIAL | — | — | — | PARTIAL — firm_id on invoices/orders/ledger/job_cards/worker_tx; pull dedupe; sequential background | P0 |
| **Gold Ledger (RPC pages)** | YES | YES | YES | YES | PARTIAL | NO | PARTIAL — desc cache unified; get_firm_ledger_balances migrated; report COUNT removed | P0 |
| **KYC PDF (worker_kyc)** | YES | YES | YES | — | PARTIAL | NO | PARTIAL — PrintEngine PDF now draws images section; portal KYC RPC migrated | P0 |
| **KYC upload (Portal)** | YES | YES | PARTIAL | — | — | NO | NOT PASS — portal chain open | P0 |
| **OAuth (Google callback)** | YES | PARTIAL | PARTIAL | — | — | — | PARTIAL — PKCE `exchangeCodeForSession` on `/auth/callback`; invite OAuth uses `invite` param + sessionStorage stash (fixes `code` collision) | P0 |
| **Customer Portal** | YES | YES | PARTIAL | — | PARTIAL | PARTIAL | PARTIAL — RLS audit open | P0 |
| **Karigar Portal** | YES | YES | PARTIAL | — | PARTIAL | PARTIAL | PARTIAL | P0 |
| **Supplier Portal** | YES | YES | PARTIAL | — | PARTIAL | PARTIAL | PARTIAL | P0 |
| **Document hosting** | YES | YES | PARTIAL | — | PARTIAL | PARTIAL | PARTIAL — 365d + RPC + plan gate `business.document_hosting`; migration apply pending | P0 |
| **Report: Delivery Summary** | YES | YES | YES | PARTIAL | PARTIAL | PARTIAL | FIXED — print-source hygiene + audit script | P0 |
| **Report: Gold Loss** | YES | YES | YES | PARTIAL | PARTIAL | PARTIAL | FIXED — error/cap banners no-print | P0 |
| **Report: Ledgers** | YES | YES | YES | PARTIAL | PARTIAL | PARTIAL | FIXED — party picker outside print root | P0 |
| **Report: GST Returns** | YES | YES | YES | PARTIAL | PARTIAL | PARTIAL | FIXED-NOT-VERIFIED — export testid present | P0 |
| **Report: Tally Export** | YES | YES | YES | PARTIAL | PARTIAL | NO | FIXED-NOT-VERIFIED | P0 |
| **Item Groups** | PARTIAL | NO | NO | NO | NO | NO | **NOT PASS** — `item_groups` table **not on QA**; migration `20260830280000` blocked (no `SUPABASE_DB_PASSWORD`) | P0 |
| **Barcode / tag registry** | YES | YES | PARTIAL | PARTIAL | PARTIAL | NO | PARTIAL — `barcode_config` firm-scoped id | P1 |
| **Customization hub** | YES | PARTIAL | PARTIAL | PARTIAL | PARTIAL | NO | PARTIAL — firm-scoped `customization_hub` id via `resolveAppSettingsReadId` | P1 |
| **CEO dashboard** | YES | PARTIAL | PARTIAL | PARTIAL | PARTIAL | NO | PARTIAL — ceo-dashboard-analytics + assistant tools firm-scoped; RPC preferred | P1 |
| **CRM / communications** | YES | YES | PARTIAL | — | PARTIAL | PARTIAL | PARTIAL | P1 |
| **MTG shell (`/mtg`)** | YES | PARTIAL | PARTIAL | BLOCKED | NO | NO | **BLOCKED** — see §MTG | BLOCKED |
| **Meena Book** | PARTIAL | NO | NO | NO | NO | NO | **BLOCKED** — NN202000 spec missing | BLOCKED |
| **Vault issue block** | YES | YES | YES | YES | — | — | NOT PASS — behavioural test open | P0 |
| **Print invoice PDF** | YES | YES | YES | — | PARTIAL | PARTIAL | NOT PASS | P0 |
| **Mobile 5-tab** | YES | PARTIAL | PARTIAL | — | PARTIAL | NO | NOT PASS | P0 |

---

## IMPLEMENTATION_MATRIX corrections (R1–R10 → PARTIAL)

All **VERIFIED** rows in `docs/IMPLEMENTATION_MATRIX.md` are **downgraded to PARTIAL** until chain evidence exists on non-prod QA.

---

## MTG BLOCKED (NN202000)

- `/mtg` gated — no new MTJ/NN202000 scope until parity PASS
- Meena business rules **BLOCKED** without authoritative spec
- Do not globalize MTG fine/purity rules

---

## Edition planning (owner DOCX)

**BLOCKED for entitlement implementation** until owner approves plan.

Reference: [`docs/AVS_ERP_PRODUCT_EDITION_PLANNING_REFERENCE.md`](../docs/AVS_ERP_PRODUCT_EDITION_PLANNING_REFERENCE.md)

- ₹10K / ₹30K / ₹50K = planning hypotheses only
- Do **not** hide modules or add locks from edition matrix alone
- Existing Ornexa BASIC/GROWTH/PRO/SCALE/MAX ladder remains reference

---

## Jwelly preference mapping

See [`docs/JWELLY_TO_ORNEXA_GAP_MATRIX.md`](../docs/JWELLY_TO_ORNEXA_GAP_MATRIX.md) — map term → AVS module → config key during Phase 6 customization audit.

---

*Updated as implementation progresses; see `FINAL_EVIDENCE_REPORT.md` when Phase 10 completes.*
