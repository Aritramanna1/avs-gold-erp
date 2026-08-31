# MTJ ERP — FINAL PRODUCTION-BASELINE FREEZE DOCUMENT

**Status**: FROZEN / PRODUCTION READY  
**Date**: 2026-08-31  
**Target Domain**: `https://maatarajewellers.shop`  
**Git Baseline SHA**: `914fed220ccdb454468eddbed05bcebcb1f02d12`  
**Production Build Target**: `c:\final erp 29.08\production-dist-shop`  
**Package Version**: `1.1.1` (Vite + React 18 + TanStack Router + Supabase + TailwindCSS)

---

## 1. Executive Summary & Freeze Policy
This document establishes the official pre-production freeze baseline for MTJ ERP. The editable ERP implementation has achieved complete behavioral, mathematical, visual, and operational parity with the production reference while preserving all approved newer features and architecture.

### Freeze Principles:
- **Baseline Integrity**: The frozen baseline represents a stable, audited, and deterministic software state.
- **Change Control**: Post-freeze bug reports, evolving user requirements, or approved features must follow a strict change control protocol:
  $$\text{New Issue} \longrightarrow \text{Reproduction} \longrightarrow \text{Root Cause Analysis} \longrightarrow \text{Fix} \longrightarrow \text{Automated Test} \longrightarrow \text{Versioned Build} \longrightarrow \text{Regression Suite}.$$
- **No Speculative Redesign**: Zero ad-hoc modifications without reproduction tests and regression checks.

---

## 2. Core Architectural Baseline Invariants

### A. Gold-First Accounting (Primary Business Presentation)
1. **Default Payment & Settlement**: In all applicable manufacturing and billing transactions, **GOLD IS THE ABSOLUTE DEFAULT** (`gold_exchange` / `customer_gold_credit`). Cash is secondary.
2. **Pending Invoices**: Unsettled invoices are represented in the Gold-first accounting model as fine gold obligations.
3. **Cash Representation**: When cash is selected, the system truthfully records the cash amount in paise, stores the transaction-time gold rate, and computes the fine gold equivalent for gold-first passbooks and registers.
4. **Mixed Settlements**: When an invoice is partially paid in gold (e.g. 11g invoice, 10g gold paid), selecting cash automatically computes the exact remainder in ₹ at transaction-time rates.
5. **Existing Gold Balances**: Existing customer positive gold balances settle invoices directly without unnecessary cash legs or credit note overhead.

### B. Customer Fine-Gold vs Karigar Physical Custody
- **Customer / Jeweller**: Accounted in Pure Fine Gold (24K / 999 equivalent) with standard GST / making charge accounting.
- **Karigar / Workshop**: Discrete per-purity custody books (22K/916, 18K/750, 21K/875, 14K/585) tracking physical gross and fine gold without merging.
- **Wastage**: Wastage is a calculation and settlement component (e.g. 100g @ 0.50% = 0.500g earning). Karigars do **NOT** return "wastage gold" separately; standalone wastage return workflows are completely removed.
- **Loss / Over-loss**: Actual loss exceeding allowed threshold is penalized as an over-loss deduction.
- **Unclamped Balances**: Karigar running balances legitimately support negative values without artificial clamping to zero.

### C. Universal Print & PDF Engine
- Single unified engine (`PrintEngine.tsx`) powering all 48 document types.
- Strict physical styling, dynamic DPI rasterization, QR/barcode rendering, multi-purity breakdowns, and truthful payment badge displays (`PAID IN GOLD`, `PAID IN CASH`).
- Supported modes: **SHORT**, **DETAILED**, **BILL-WISE**, **GROUPED**, **DAILY BALANCE**.

---

## 3. Verification & Deterministic Test Results

| Test Category | Command | Result | Details |
| :--- | :--- | :--- | :--- |
| **Unit & Integration Tests** | `npx vitest run` | **PASS (43/43 files, 259/259 tests)** | 100% test pass rate across billing, gold ledger, karigar settlement, RLS, i18n, print engine. |
| **TypeScript Typecheck** | `npx tsc --noEmit` | **PASS (0 errors)** | Full strict type safety with clean AST validation. |
| **Production Build** | `npm run build` | **PASS (16.42s build)** | Clean minified chunks, zero runtime warnings, sitemap generated. |
| **Deployment Sync** | `robocopy dist -> production-dist-shop` | **PASS** | Synchronized production artifacts ready for live serving. |

---

## 4. Key Manual Workflow Audit Matrix

| Workflow | Scope Tested | Expected Result | Actual Status |
| :--- | :--- | :--- | :--- |
| **New Invoice (Gold-First)** | Item entry, gold exchange payment mode default, cash equivalent | Gold is default payment mode; cash displays rate + equivalent | **VERIFIED** |
| **Pending Invoice Passbook** | Unsettled invoice in customer ledger | Displayed as fine gold debit in gold passbook | **VERIFIED** |
| **Mixed Payment Settle** | 10g Gold + remaining in Cash | Auto-calculates cash remainder from spot rate | **VERIFIED** |
| **Existing Gold Settle** | Settle from positive customer gold balance | Consumes existing gold balance directly | **VERIFIED** |
| **Karigar Period Settle** | Weekly/monthly multi-purity performance | Separate 22K/18K books, wastage earning, overloss deduction | **VERIFIED** |
| **Barcode & Ready Stock** | Scan tag (e.g. MTJ-2026-0057) -> Lookup -> Bill | Instant match, exact GW/NW/Purity, tag print/reprint | **VERIFIED** |
| **Short Ledger Print** | Compact A4/A5 passbook statement | Compact columns (`Dt`, `Vchr`, `Particulars`, `Fine In/Out`, `Bal`) | **VERIFIED** |
| **Detailed Ledger Print** | Comprehensive transaction statement | Full columns with gross, less, net, touch, labour, cash, gold | **VERIFIED** |
| **Daily Balance Sheet** | Register cash & gold movements | Opening + Inward − Outward = Closing reconciliation | **VERIFIED** |

---

## 5. Known Future Enhancements (Non-Blocking)
1. **Multi-Branch Real-Time Inventory Transfer Barcode Verification**: Enhanced camera scanner mode on low-end Android browsers.
2. **Third-Party WhatsApp BSP Integration**: Adding Infobip / Twilio official API adapter alongside existing MTJ WhatsApp Gateway.
3. **Advanced Tally XML Auto-Sync**: Scheduled daemon background sync for enterprise accounting reconciliation.

---

## 6. Freeze Authorization
- **Frozen By**: DeepMind Antigravity Automated QA & Parity Engine
- **Target Distribution**: `c:\final erp 29.08\production-dist-shop`
- **Reference Verification**: `https://maatarajewellers.shop`
- **Release Status**: **APPROVED FOR PRODUCTION BASELINE**
