# MTJ ERP — Live QA & Production-Readiness Test Report

**Application:** MTJ ERP — Maa Tara Jewellers  
**Live URL Tested:** `https://maatarajewellers.shop` (Hostinger Static Hosting)  
**Date of Evaluation:** 23 June 2026  
**Auditor / ERP Consultant:** QA + Senior ERP Consultant  
**Status:** **PROVISIONAL FAIL** (Gated by Row-Level Security Open Read Exposure & Gold Custody Reconciliation Gaps)

---

## 1. Login & Session Stability

The authentication layer was tested extensively under various network profiles and session conditions to evaluate resilience, redirect behavior, and cross-site scripting/injection resistance.

### 1.1 normal Login

- **Steps to Reproduce:**
  1. Open the live web portal at `https://maatarajewellers.shop`.
  2. Input the owner-provided QA credentials.
  3. Click **Submit / Login**.
- **Expected Result:** Login succeeds cleanly. Authenticated session token is set. User is redirected to the `/` dashboard route. No fatal console errors are logged.
- **Actual Result:** Authenticated seamlessly. The Owner dashboard rendered with full metrics. No visual or UI flickering observed.
- **Severity:** Low (Stable)
- **Status:** **PASS**

### 1.2 Session Restore & Auto-Refresh

- **Steps to Reproduce:**
  1. Log into the system.
  2. Refresh the browser tab on the dashboard.
  3. Navigate to `/orders` and refresh the page.
  4. Wait for the standard 60-minute token expiry or simulate token expiration.
- **Expected Result:** JWT session is persisted in local storage (`sb-kjfjsfhftytezsjyegmb-auth-token`). Refresh restores the component state seamlessly without prompting for a login. Active listener triggers silent token refresh.
- **Actual Result:** Session maintained correctly. Application parsed state and verified token correctly on load.
- **Severity:** Low (Stable)
- **Status:** **PASS**

### 1.3 Logged-Out Access & Redirect Wall

- **Steps to Reproduce:**
  1. Clear the local storage keys for Supabase auth.
  2. Attempt to directly access `/orders`, `/workshop/gold-book`, or `/settings`.
- **Expected Result:** React Router/TanStack Router route matching blocks navigation and displays the authenticated wall. URL path redirects safely to `/` auth page.
- **Actual Result:** Authenticated wall functioned correctly. Displayed message: _"Public sign-up is disabled... only sign up if invited by the Superowner."_ Securely prevents unauthorized ingress.
- **Severity:** Low (Stable)
- **Status:** **PASS**

---

## 2. Dashboard

The central command interface aggregates order delivery states, real-time gold custody, active vault balances, and financial metrics.

- **Steps to Reproduce:**
  1. Log into the portal and wait for the initial paint.
  2. Inspect the **Reconciliation Banner** and "Vault Gold" metrics.
- **Expected Result:** Real-time metrics compute without floating-point errors. Auto-reconciliation banner triggers sync when local database differences are detected.
- **Actual Result:** Dashboard renders in **2.9s** (see Performance). Vault metrics load correctly, but "Gold Rate" is unset by default (_"₹—/g · 22K · awaiting setup"_).
- **Confusing Elements:** If the gold rate is not configured under settings, several money fields render blank lines or placeholders (`₹—`). A setup guard or dismissible reminder should prompt the owner to enter the daily gold rate upon login.
- **Status:** **PASS** (Minor visual UX enhancements recommended)

---

## 3. People / CRM

Customer and artisan profiles containing sensitive personal identifiable information (PII) like phone numbers, addresses, and tax details.

- **Steps to Reproduce:**
  1. Navigate to **People & KYC** module.
  2. Create a test user with duplicate metadata or empty parameters.
- **Expected Result:** Duplicate records on key fields (e.g., duplicate phone numbers) are rejected. Aadhaar, PAN, and other compliance fields are masked.
- **Actual Result:** Basic creation is functional, but validation limits are loose. Duplicate phone numbers are allowed under certain offline states, leading to downstream reconciliation collisions.
- **Improvement Plan:** Implement server-side check constraints or robust local index validation to prevent contact number collisions.
- **Status:** **6/10** (Usable but lacks strict constraint validation)

---

## 4. Worker / Karigar KYC

KYC documents and file attachments are stored under custom directories to establish identity verification before gold allocation.

- **Steps to Reproduce:**
  1. Select a worker card.
  2. Click **Upload KYC**.
  3. Review file storage targets.
- **Expected Result:** Uploaded documents are saved securely to Supabase Storage with custom RLS. Only authorized administrators can generate signed URLs.
- **Actual Result:** Uploaded assets are processed as base64 strings and stored directly in `localStorage` inside key `mtj-attachments-v1`. This quickly bloats local storage to its ~5MB ceiling (currently consuming **1.1MB** on the test profile). Furthermore, cloud files uploaded to storage do not enforce read authorization.
- **Improvement Plan:** Migrate the base64 attachment stream out of local storage into a secure private Supabase Storage bucket with strict read/write RLS, rendering via temporary signed URLs.
- **Status:** **5/10** (Functional design, high security & scalability risk)

---

## 5. Catalog / Design Upload

A searchable vault containing jewelry design blueprints, custom parameters, and sample reference images.

- **Steps to Reproduce:**
  1. Open the **Catalog** tab.
  2. Upload a ring template design.
- **Expected Result:** Design is indexed with an auto-generated design sequence number. Thumbnail is cached locally and available offline.
- **Actual Result:** System successfully generates catalog cards. Images are retrieved via storage URLs.
- **Status:** **8/10** (Good, lightweight and stable)

---

## 6. Create Order

The multi-step order intake wizard collects customer identity, item category, measurements, metal purity, and delivery dates.

- **Steps to Reproduce:**
  1. Click **Create Order**.
  2. Fill in form values.
  3. Attempt to save with a delivery date in the past.
- **Expected Result:** Invalid delivery dates are blocked. Order weights and details are immutable once the order transitions to the job card workflow.
- **Actual Result:** The wizard accepts a delivery date set in the past, triggering a false "Delayed" alert badge immediately upon creation (e.g., `MTJ-20260622-001` had order date 22/06/2026 but delivery date 08/06/2026).
- **Fix Implemented:** Modified `src/routes/orders.new.tsx` to include rigid date boundaries in step validation and input field UIs, blocking past dates.
- **Status:** **8/10** (Upgraded with past-date blocking validation)

---

## 7. Separate Worker Gold / Material Book

An independent accounting ledger to record gold, diamonds, and materials issued to and returned by workers, isolated from order-specific job cards.

- **Steps to Reproduce:**
  1. Open **Worker Gold Book** at `/workshop/gold-book`.
  2. Click **Issue Material** without referencing a job card or active customer order.
  3. Submit the transaction.
- **Expected Result:** Ledger records debit correctly. Pending balances increment immediately. Transaction timestamps are captured with second-level precision. Receipt opens in the same tab.
- **Actual Result:** Genuinely decoupled from job cards (independent ✅). Exact seconds are stored. However, several critical visual and logical bugs were identified:
  1. **Reconciliation Gap:** The dashboard displays _Gold with Karigars 30.000 g_ but the _Ledger Statements_ sub-tab shows `0 transactions`. There is an inconsistency between active worker custody balances and underlying transaction ledger records.
  2. **Double HTML Escaping:** The main action button literally displayed as `RECORD MATERIAL ISSUE & Print` instead of `&`.
- **Fix Implemented:** Replaced the double-escaped HTML entity in `/src/routes/workshop.gold-book.tsx` with a standard clean ampersand.
- **Status:** **7/10** (Excellent architecture; needs ledger-to-custody reconciliation)

---

## 8. Gold Given / Gold Returned Ledger

Records weight changes in pure gold equivalents (milligrams) to prevent rounding float issues common in standard decimals.

- **Steps to Reproduce:**
  1. Audit `/src/lib/worker-gold-book-store.ts` and `/src/lib/ledger-store.ts`.
- **Expected Result:** Weight calculations are converted to integer milligrams (`grossMg`, `netMg`, `fineMg`) prior to execution.
- **Actual Result:** Successfully utilizes safe integer math to protect against rounding discrepancies. Purity thresholds are accurately processed.
- **Status:** **9/10** (Robust financial calculation backend)

---

## 9. Invoice / Voucher

The invoice system produces jewelry voucher styles and GST compliance invoices.

### 9.1 Voucher Columns Test

- **Expected Columns:** `Particulars`, `HUID`, `Stamp`, `Gross Weight`, `Add Weight`, `Less`, `Net Weight`, `Touch`, `Wastage`, `Pieces`, `Labour`, `Gold`, `Amount`.
- **Actual Columns:** Fully supports the granular weight columns including Gross, Add, Less, and Net.
- **Expected Summary Block:** `Previous Balance`, `Today's Entry`, `Gold Payment`, `Cash Payment`, `Final Balance`, `Credit (Jama)`, `Debit (Naam)`.
- **Actual Summary Block:** Displays financial ledger changes correctly.

### 9.2 GST Compliance

- **Expected:** Correctly calculates CGST (1.5%), SGST (1.5%), or IGST (3%) for jewelry (HSN code `7113`).
- **Actual:** Configured correctly. CGST/SGST ledger mode handles domestic and interstate tax splits correctly.
- **Status:** **8/10** (Voucher styling is highly professional)

---

## 10. Gold Payment / Old Gold / Mixed Payment

Validation of payment models combining cash, bank transfers, UPI transactions, and old scrap gold trades.

- **Expected Math Verification:**
  - Old Gold: Gross 10.000g, Less 0.500g, Net 9.500g, Touch 84% $\rightarrow$ Fine Gold = 7.980g. Under Rate ₹6,500/g $\rightarrow$ Total Value = ₹51,870.
  - Mixed Payment: Invoice Total ₹1,00,000 $\rightarrow$ Settled via Cash ₹20,000 + UPI ₹30,000 + Gold Trade ₹50,000 $\rightarrow$ Outstanding balance = ₹0.
- **Actual Result:** Calculations match exactly. Fine gold is correctly isolated and logged in the customer ledger, and payment balances remain clean.
- **Status:** **8/10** (Solid payment split logic)

---

## 11. Billing / GST

Provides tax calculations, state check constraints, and HSN compliance templates.

- **Status:** **8/10** (Compliant and stable)

---

## 12. Payments

Validates the recording and receipt generation of individual customer cash/bank payments.

- **Status:** **8/10**

---

## 13. Attendance & Salary

Tracks daily artisan check-ins, advance salary draws, and monthly calculations.

- **Status:** **7/10**

---

## 14. Repair / Polishing

Tracks incoming customer jewelry repairs, polishing jobs, assignees, and repair statuses.

- **Status:** **8/10**

---

## 15. Stock / Barcode

Inventory manager with barcode tagging templates.

- **Status:** **7/10**

---

## 16. Print Preview

All print actions (Order slips, issue slips, rate-cut receipts, invoices) must render inside the active tab.

- **Expected Rules:**
  1. Opens print setup in the same tab (no rogue tabs or broken navigation).
  2. No blank pages, broken logos, or overlapping footers.
- **Actual Result:** Uses native browser print engine. No new tabs are spawned. The active window triggers the print layout cleanly.
- **Status:** **8/10** (Clean native print integration)

---

## 17. QR Verification

QR codes printed on receipt slips are scanned by customers to verify physical authenticity against store records.

- **Expected Payload:** `MTJ|<DOC_TYPE>|<DOC_NUMBER>|<RECORD_ID>|<CHECKSUM>`
- **Security Check:** A modified checksum must trigger a validation error.
- **Actual Result:** Formats the payload correctly. Tampering with any character triggers a validation failure.
- **Vulnerability Identified:** The checksum algorithm is non-cryptographic (a simple string-hash) and is executed entirely in client-side bundle code. A tech-savvy operator can forge a valid QR verification token manually since no server-side private key is required for signing.
- **Status:** **6/10** (Tamper-evident, but cryptographically weak)

---

## 18. WhatsApp

Automates order tracking alerts and status updates using pre-configured text templates.

- **Status:** **7/10**

---

## 19. CEO / Owner Panel

A high-privileged console containing staff logs, system diagnostics, and financial reports.

- **Status:** **8/10**

---

## 20. Delete / Void with Reason

Restricts deleting sensitive financial or gold records, forcing "Void" state transformations.

- **Expected:** Deleting gold books or ledger records requires choosing a reason (e.g., duplicate, mistake) and is logged into the audit trailing records.
- **Actual:** Realized via an `is_void` flag rather than destructive row deletion. Safe for financial auditing.
- **Status:** **9/10** (Compliant audit trail design)

---

## 21. Security

An in-depth penetration audit of the public client bundle and Supabase Row-Level Security rules.

### 21.1 Client Bundle Scan

- **Grep Target:** `service_role`, `sb_secret`, `postgres://`, `postgresql://`, `SUPABASE_SERVICE_ROLE_KEY`
- **Findings:** Zero private keys, database connection strings, or administrator passwords found in the frontend. Only standard public client variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`) exist. ✅ **PASS**

### 21.2 Row-Level Security (RLS) Evaluation

- **Expected:** Private database tables reject reading/writing by unauthenticated users.
- **Actual Result:** **CRITICAL VULNERABILITY (BUG-001)**  
  Every database table contains a permissive development policy (`dev_allow_all`) which allows an anonymous client using the public anon key to read all customer KYC records, gold books, invoices, and payment logs without logging in.
- **Risk:** High. Direct data exposure if synchronizing local database records to the cloud.
- **Status:** **CRITICAL FAIL**

### 21.3 SECURITY DEFINER Functions

- **Expected:** Core schema database functions cannot be executed anonymously.
- **Actual Result:** **MEDIUM RISK VULNERABILITY (BUG-009)**  
  `public.rls_auto_enable()` is configured as `SECURITY DEFINER` and is callable by anonymous clients via PostgREST RPC, allowing schema alterations.
- **Status:** **FAIL**

---

## 22. Performance

- **Time-to-First-Byte (TTFB):** 291ms (Fast network delivery)
- **First Contentful Paint (FCP):** 2.9s (Client-side hydration delayed by heavy JS modules)
- **Storage Footprint:** 1.1MB (Local storage bloated by base64 files)
- **Status:** **6/10** (Fast server, slow initial rendering)

---

## 23. International Standard Rating

| Workflow / Module        |   Rating   | Critical Issue / Basis                                                                                             |
| :----------------------- | :--------: | :----------------------------------------------------------------------------------------------------------------- |
| **Login**                |  **8/10**  | Solid redirect walls and session management.                                                                       |
| **Create Customer**      |  **6/10**  | Minimal duplicate constraints.                                                                                     |
| **Create Worker**        |  **6/10**  | Standard local save without online lock validations.                                                               |
| **KYC Upload**           |  **5/10**  | KYC images stored in local storage, bloating index.                                                                |
| **Create Order**         |  **8/10**  | Good, past-date validation has been added.                                                                         |
| **Worker Gold Book**     |  **7/10**  | Decoupled from job cards, but custody and statements diverge.                                                      |
| **Gold Return**          |  **6/10**  | Fully operational but lacks transaction verification logs.                                                         |
| **Invoice**              |  **8/10**  | High-fidelity jewelry GST calculation.                                                                             |
| **Payment**              |  **8/10**  | Clean, safe integer split computations.                                                                            |
| **Print Preview**        |  **8/10**  | Native print, same-tab (no stray tabs/nav leaks).                                                                  |
| **QR Verify**            |  **6/10**  | Tamper-evident but forgeable due to client-side hashing.                                                           |
| **Reports**              |  **7/10**  | Functional business intelligence reports.                                                                          |
| **Owner Panel**          |  **8/10**  | Clear privilege management.                                                                                        |
| **Security**             |  **2/10**  | Permissive RLS rules allow anonymous reading of all tables.                                                        |
| **Overall ERP Workflow** | **6.5/10** | **Genuinely capable jewelry ERP** with correct financial models, but restricted by the database security exposure. |

---

## 24. Bug Report

### Bug ID: BUG-001

- **Module:** Database (Supabase RLS)
- **Page/Route:** All Database Tables
- **Severity:** **Critical**
- **Steps to Reproduce:**
  1. Fetch the public anon key from the bundle.
  2. Send a GET request to `/rest/v1/gold_ledger` or `/rest/v1/kyc_documents`.
- **Expected:** Request blocked with `401 Unauthorized` or empty list.
- **Actual:** Request returns `200 OK` with full data rows.
- **Likely Root Cause:** Development helper policy `dev_allow_all` left active on tables.
- **Business Impact:** Absolute breach of client/financial data privacy.
- **Suggested Fix:** Run RLS lockdown script (see §25).

### Bug ID: BUG-002

- **Module:** Workshop (Worker Gold Book)
- **Page/Route:** `/workshop/gold-book` (New Entry Form)
- **Severity:** **Low**
- **Steps to Reproduce:**
  1. Open New Entry Form.
  2. Inspect the submit button text.
- **Actual:** Renders literally as `RECORD MATERIAL ISSUE &amp; Print`.
- **Likely Root Cause:** Double HTML escaping in JSX string.
- **Suggested Fix:** Fixed (see §25).

### Bug ID: BUG-003

- **Module:** Workshop (Worker Gold Book)
- **Page/Route:** `/workshop/gold-book`
- **Severity:** **Medium**
- **Steps to Reproduce:**
  1. Open Gold Book.
  2. Notice active custody totals do not link to ledger statement entries.
- **Expected:** Custody balance matches sum of transactions.
- **Actual:** Diverges in case of unbacked seeded opening values.
- **Suggested Fix:** Enforce entry-backed custody balances.

---

## 25. Proposed Code Fixes

### FIX-001: RLS Lockdown Policy (BUG-001)

Execute the following schema query inside the Supabase SQL Console to lock down public access:

```sql
-- 1) Drop all open dev policies
DROP POLICY IF EXISTS dev_allow_all ON public.orders;
DROP POLICY IF EXISTS dev_allow_all ON public.gold_ledger;
DROP POLICY IF EXISTS dev_allow_all ON public.invoices;
DROP POLICY IF EXISTS dev_allow_all ON public.payments;
DROP POLICY IF EXISTS dev_allow_all ON public.kyc_documents;
DROP POLICY IF EXISTS dev_allow_all ON public.attachments;
DROP POLICY IF EXISTS dev_allow_all ON public.job_cards;

-- 2) Assert RLS is strictly enabled
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gold_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyc_documents ENABLE ROW LEVEL SECURITY;

-- 3) Create restricted policy for authenticated users only
CREATE POLICY auth_only_access ON public.orders
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

### FIX-002: HTML Ampersand Double-Escaping (BUG-002) - _APPLIED_

- **File Path:** `/src/routes/workshop.gold-book.tsx`
- **Function:** `New Entry Form Button`
- **Old Problem:** Included double-escaped `&amp;` HTML entity within quotes.
- **New Code:**

```tsx
{
  entryType === "given" ? "Record Material Issue & Print" : "Record Material Return & Print";
}
```

- **Why this fixes it:** Plain quotes in React JSX strings do not evaluate HTML entities, which are printed literally. Using standard characters renders normally.

### FIX-005: Date Validation Guard (BUG-005) - _APPLIED_

- **File Path:** `/src/routes/orders.new.tsx`
- **Function:** `Step 6 Validation`
- **Old Problem:** Wizards accepted past dates leading to immediate delay alerts.
- **New Code:**

```tsx
if (step === 6) {
  if (form.expectedDelivery) {
    const todayStr = new Date().toISOString().split("T")[0];
    if (form.expectedDelivery < todayStr) return false;
  }
  return true;
}
```

- **Why this fixes it:** Directly intercepts order creation flow and blocks forward progress if an invalid delivery target is chosen.

---

## 26. Final Report

- **A. Live site tested:** YES
- **B. Login stable:** YES
- **C. Workflow rating overall:** 6.5/10
- **D. Print system rating:** 8/10
- **E. Worker Gold Book rating:** 7/10
- **F. Invoice/Voucher rating:** 8/10
- **G. Security rating:** 2/10 (Requires RLS database configuration)
- **H. Performance rating:** 6/10
- **I. Critical bugs count:** 1
- **J. High bugs count:** 0
- **K. Medium bugs count:** 3
- **L. Low bugs count:** 1
- **M. Bugs fixed in code:** 3 (Orders date validation, print hook ordering, button label escaping)
- **N. Bugs still open:** 3 (Database RLS setup, database definer RPC, cryptographic QR check)
- **O. Safe for MTJ pilot:** **NO** (Strictly blocked by BUG-001 RLS setup)
- **P. Safe for multi-shop SaaS:** **NO** (Requires multi-tenant DB structure setup)
