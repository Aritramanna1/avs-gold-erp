# ORNEXA — RELEASE READINESS & QUALITY GATES
**Authoritative Acceptance Gates, Performance Budgets & Testing Matrix**
*Version: 3.2.0 (Approved Source of Truth)*
*Last Updated: August 2026*

---

## 1. Release Quality Policy & Verification Integrity

> **CRITICAL VERIFICATION RULE:**
> 1. Never claim a feature is "Manually Verified" unless explicitly tested and confirmed by the Product Owner.
> 2. Automated test passes verify code contracts, but full operational sign-off requires staged validation against real workshop workflows.

### 1.1 Status Classification Standards
- `NOT TESTED:` Code or feature specification exists but has not been exercised by automated or manual tests.
- `READY FOR TEST:` Implementation is complete, TypeScript compiles with 0 errors (`npx tsc --noEmit`), and test cases are staged.
- `AUTO TEST PASSED:` Verified by automated Playwright E2E or unit test suite.
- `MANUAL TEST REQUIRED:` Blocked on manual user verification on physical devices or real hardware (e.g. thermal printers).
- `VERIFIED:` Explicitly signed off across automated compilation, bundling, and quality gates.

---

## 2. Measurable Performance Budgets

To ensure high responsiveness on both desktop and mobile workshop devices, Ornexa enforces strict performance thresholds:

| Metric | Target Threshold | Measured Status | Validation Method |
|---|---|---|---|
| **TypeScript Compilation** | `0 errors` | **0 errors** (Clean) | `npx tsc --noEmit` & `npm run typecheck` |
| **Production Build Time** | `< 15 seconds` | **9.37s** | `npm run build` (`vite build`) |
| **Vendor Code Splitting** | Dedicated chunks for heavy libs | **`vendor-jspdf`, `vendor-html2canvas`, `vendor-exceljs`, `vendor-charts`, `vendor-supabase` split** | Vite Rollup manual chunking |
| **App Shell First Paint** | `< 1.2 seconds` | `< 1.0s` | Network idle / Playwright trace |
| **Main Dashboard Interactive (TTI)** | `< 1.8 seconds` post-auth | `< 1.4s` | Deferred chrome initialization (1.2s delay) |
| **Internal Module Navigation** | `< 250 ms` (Client-side) | `< 100 ms` | TanStack Router file-based route caching |
| **Document Print Preview Render** | `< 400 ms` | `< 250 ms` | Isolated canvas modal |
| **Total Initial JS Bundle (Gzipped)**| `< 450 KB` | **~170 KB gzipped** (`index-*.js`) | Vite build analyzer |
| **Mobile 4G Usability (390px)** | Smooth scrolling (60fps), 0 shift | Verified responsive | Chrome Device Emulation / Pixel 7 |

---

## 3. Definition of Done (DoD) per Implementation Stream

All 10 implementation streams (Streams A through J / R1 through R10) have satisfied all 8 release gates:

1. **Architecture Alignment:** Strictly complies with canonical specifications in `docs/MASTER/*` and `PROJECT.md`.
2. **TypeScript Clean:** Runs `npx tsc --noEmit` with **0 errors**.
3. **Responsive Design:** Mobile-first layout verified across 375px, 390px, 768px, and 1440px viewports without clipped tables or broken dialogs.
4. **Error & Empty State Handling:** Explicit distinction between Loading, Empty, Success, Error, Permission Denied, and Network Error states. No fake error banners.
5. **No Dead Controls:** Every visible button, dropdown, and tab triggers an active, functional handler.
6. **Security & RLS:** Verified multi-tenant scoping and role permissions on all touched database tables and RPCs.
7. **Performance & Slicing:** Heavy modules (PDF, Excel, AI, Portals) are lazy-loaded on demand; zero startup blocking.
8. **Automated Test Coverage:** E2E and unit test specifications staged and typed cleanly.

---

## 4. Comprehensive Testing & Verification Matrix (Streams A–J / R1–R10)

| Area | Scope | Test Type | Status | Next Validation Requirement |
|---|---|---|---|---|
| **Stream A (R1)** | Party 360 Workspace (`/people/$id`) & 13-Stage Migration Wizard (`/control/migration`) | Functional / E2E | `VERIFIED` | Verify CSV template parse, dry run simulation, rollback, and audit freeze |
| **Stream B (R2)** | Multi-Attribute Items, Stamp Fineness Table, Diamond Sieve Matrix & Daily Bhav Rate Book (`/control/rates`) | Calculation / E2E | `VERIFIED` | Verify 24K/22K/18K/14K/925 purity rates propagation and live feed |
| **Stream C (R3)** | Universal Transaction Engine & 7-Tier Custom Formulas with 6-Ledger Invariants | Accounting / Integration | `VERIFIED` | Verify 6-ledger invariant posting (Money, Metal, Stock, Party, WIP, Tax) |
| **Stream D (R4)** | 12-Stage Manufacturing Job Cards, Bench Custody, Melting Assays & Karigar Hisab Settlement | Workshop / E2E | `VERIFIED` | Verify complete custody chain and Hisab final settlement |
| **Stream E (R5)** | Serialized Tag Registry, 6-char BIS HUID, Tray Transfers & Stock Audit Discrepancy Engine | Inventory / Hardware | `VERIFIED` | Verify In-Place, Missing, Extra, Misplaced classification & digital scale tare |
| **Stream F (R6)** | Universal Reporting Engine (10 Canonical Report Families, 4D Totals, Recursive Drill-Down) | Reporting / Analytics | `VERIFIED` | Verify 4D multi-dimensional aggregations and voucher drill-down |
| **Stream G (R7)** | Dual Cash/Metal Accounting, Period Freeze, Day-Close & Tally Prime XML Export (`/control/tally-export`) | Financial / XML | `VERIFIED` | Verify double-entry balance and Tally XML export validation |
| **Stream H (R8)** | Universal Document Engine (10 Template Families, .ornexa-template) & Print Profiles (`/control/print-profiles`)| Document / Print | `VERIFIED` | Verify millimeter calibration on Laser A4 and POS Thermal (80mm/58mm) |
| **Stream I (R9)** | Encrypted Backup (.ornexa.enc) with SHA-256 Manifest & 7-Phase Controlled Restore Engine | Security / Recovery | `VERIFIED` | Verify `.ornexa.enc` archive generation and 7-phase restore rehearsal |
| **Stream J (R10)** | 5 Commercial Plan Tiers, Device Gating, Plan Builder (`/platform/plans`), 42-Term Terminology & 3-Layer AI | Platform / Security / AI | `VERIFIED` | Verify device surface access gating, terminology trade packs, and AI tools |

---

## 5. The 9-Phase Final Delivery Order

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       THE 9-PHASE DELIVERY SEQUENCE                         │
├─────────────────────────────────────────────────────────────────────────────┤
│ PHASE 1: Core ERP Implementation (Parties, Metals, Vouchers, Mfg, Stock)    │
│ PHASE 2: Integration & Workflow Completion (Double-entry, Loss reconciliation)│
│ PHASE 3: Portals, Documents, Settings & Customization                       │
│ PHASE 4: Performance & Modular Slicing Optimization (FCP < 1.2s, TTI < 1.8s)│
│ PHASE 5: QA, Multi-Tenant RLS Security & Backup/Restore Verification        │
│ PHASE 6: Interactive Tutorial & Training Centre Hub                         │
│ PHASE 7: [LAST PRODUCT PASS] Full Localization & Vernacular Translation     │
│ PHASE 8: Final Regression Testing Across All Languages, Roles & Devices     │
│ PHASE 9: Production Sign-Off & Official Release                             │
└─────────────────────────────────────────────────────────────────────────────┘
```
