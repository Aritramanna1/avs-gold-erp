# 04. Ornexa Complete Codebase & Functional Audit
**Date:** 2026-08-12  
**Target Codebase:** `c:\avs-test-install\emergent-mtj-V1`  

This document provides a function-by-function and route-by-route audit of the existing Ornexa codebase, serving as a comprehensive technical reference for AI assistants and developers.

---

## 1. Core Logic Stores & Engines (`src/lib/`)

### 1.1. Gold & Cash Ledger: [`ledger-store.ts`](file:///c:/avs-test-install/emergent-mtj-V1/src/lib/ledger-store.ts)
*   **Purpose**: Append-only double-entry transaction store for fine gold weights (mg) and cash values (paise) across six buckets: `vault`, `karigar`, `finished`, `customer`, `jeweller`, and `scrap`.
*   **Key Functions**:
    1.  `calculateLiveGoldExposure(balances: BucketBalances, pendingOrdersFineMg: number)`: Computes physical asset totals vs. liabilities, flagging unhedged rate exposure.
    2.  `useLedger.append(entry)`: Validates that deltas sum to `netFineMg`. Checks period locks and Karigar credit limits before appending.
    3.  `useLedger.refresh()`: Fetches logs from Supabase, applying branch-level filtering.
    4.  `useLedger.reverse(id, reason)`: Offsets a ledger entry, posting audit logs.

### 1.2. Period Locks: [`financial-lock-store.ts`](file:///c:/avs-test-install/emergent-mtj-V1/src/lib/financial-lock-store.ts)
*   **Purpose**: Gating mechanism preventing retroactive edits inside locked/closed financial periods.
*   **Key Functions**:
    1.  `assertPeriodOpen(branchId: string, timestamp: string)`: Throws a validation error if the date falls within a closed/frozen month.
    2.  `ensureFinancialLocksLoaded()`: Caches active locks locally.
    3.  `closeFinancialPeriod(branchId: string, year: number, month: number)`: Flags a period as locked.

### 1.3. System Settings & Rates: [`settings-store.ts`](file:///c:/avs-test-install/emergent-mtj-V1/src/lib/settings-store.ts)
*   **Purpose**: Manages system state, branch configurations, user roles, and live/simulated metal rates.
*   **Key Functions**:
    1.  `useSettings.setMetalRate(metal: string, purity: string, sellingRatePaise: number)`: Updates rates in the database.
    2.  `useSettings.setSelectedBranchId(branchId: string)`: Switches contexts.

### 1.4. Calculation Engine: [`calculation-engine.ts`](file:///c:/avs-test-install/emergent-mtj-V1/src/lib/calculation-engine.ts)
*   **Purpose**: Reusable math engine calculating weight conversions, making charges, and tax bases.
*   **Key Functions**:
    1.  `calculateGrossToFine(grossWeightMg: number, touchPercentage: number)`: Returns fine gold weight.
    2.  `calculateLaborCharges(weightMg: number, ratePaise: number, laborMethod: string)`: Computes pricing based on flat rates, per-gram charges, or percentage bases.
    3.  `calculateWastage(netWeightMg: number, wastagePercentage: number)`: Returns wastage weight limits.

### 1.5. Sync & Seeding: [`data-loader.ts`](file:///c:/avs-test-install/emergent-mtj-V1/src/lib/data-loader.ts)
*   **Purpose**: SQLite <-> Supabase background sync, pulling critical data, and auto-seeding empty schemas.
*   **Key Functions**:
    1.  `startCloudSync()`: Initializes background sync loop.
    2.  `pullCritical()`: Loads settings, branch catalogs, and vaults.
    3.  `seedPilotDataset()`: Autogenerates demo data if vaults are empty.

### 1.6. Job Work Returns: [`itc04-store.ts`](file:///c:/avs-test-install/emergent-mtj-V1/src/lib/itc04-store.ts)
*   **Purpose**: Reconciling raw metal outputs sent to workshops under GST Section 143 rules.
*   **Key Functions**:
    1.  `useItc04.addRecord(jobCardId: string, issuedDate: string)`: Starts tracking.
    2.  `useItc04.getAlertList(daysLimit: number)`: Flags jobs nearing the 300-day return deadline.

### 1.7. Tally XML Export: [`tally-export-engine.ts`](file:///c:/avs-test-install/emergent-mtj-V1/src/lib/tally-export-engine.ts)
*   **Purpose**: Exporting financial ledgers to Tally ERP.
*   **Key Functions**:
    1.  `exportToTallyXml(entries: LedgerEntry[])`: Formats transactions into `TALLYMESSAGE` XML.

### 1.8. Print Engine: [`print-document.ts`](file:///c:/avs-test-install/emergent-mtj-V1/src/lib/print-document.ts)
*   **Purpose**: Custom print renderer that creates a hidden iframe to bypass modal background styling cutoffs.
*   **Key Functions**:
    1.  `printHtmlInWebBrowser(htmlContent: string)`: Injects and prints the content.

---

## 2. Analytical & POS Billing Engines

### 2.1. Recharts Dashboard Charts: [`dashboard.ceo.tsx`](file:///c:/avs-test-install/emergent-mtj-V1/src/routes/dashboard.ceo.tsx)
*   **Purpose**: Renders visual analytics for metal stocks, sales pipelines, and Karigar work loads.
*   **Charts Audited**:
    - **`GoldTrendChart`**: An `AreaChart` mapping running fine gold grams over a 30-day window (`computeBalances`).
    - **`ProductionPipelineChart`**: A `BarChart` showing active Job Cards counts grouped by status stage (`JOB_STATUS_FLOW`).

### 2.2. Stock Aging Calculation: [`reports.inventory-ageing.tsx`](file:///c:/avs-test-install/emergent-mtj-V1/src/routes/reports.inventory-ageing.tsx)
*   **Purpose**: Evaluates how many days items have been sitting in vault stock.
*   **Rules & Buckets**:
    - Calculates age: `ageDays(createdAt) = Math.floor((Date.now() - createdAt) / (1000 * 60 * 60 * 24))`
    - Buckets: `0-30 days`, `31-60 days`, `61-90 days`, `91-180 days`, `181-365 days`, `365+ days`.

### 2.3. POS Checkout Discount Rules: [`BillingModule.tsx`](file:///c:/avs-test-install/emergent-mtj-V1/src/modules/billing/BillingModule.tsx)
*   **Purpose**: Form interface for managing transaction discounts and adjustments.
*   **Logic**:
    - Calculates discounts on a flat rate or percentage basis.
    - Discount values are constrained by user roles (e.g. Sales Executive max 2%). Overrides trigger warning checks and manager approvals.

---

## 3. Active Routing Audits (`src/routes/`)


### 2.1. Customer Portal: [`customer-portal.tsx`](file:///c:/avs-test-install/emergent-mtj-V1/src/routes/customer-portal.tsx)
*   **Purpose**: Customer facing dashboard for checking order statuses and savings schemes.
*   **Login**: OTP based authentication mapping to `customer_profiles` table.

### 2.2. Karigar Portal: [`karigar-portal.tsx`](file:///c:/avs-test-install/emergent-mtj-V1/src/routes/karigar-portal.tsx)
*   **Purpose**: Self service workshop dashboard displaying active job cards, outstanding gold weights, and historical wastage records.
*   **Login**: OTP based authentication mapping to `worker_profiles`.

### 2.3. RetailPOS Invoicing: [`platform.tsx`](file:///c:/avs-test-install/emergent-mtj-V1/src/routes/platform.tsx)
*   **Purpose**: Main ERP navigation shell hosting modules for sales orders, raw vaults, cataloging, and daily rate configurations.
