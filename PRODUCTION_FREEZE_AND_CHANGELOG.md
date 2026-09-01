# MTJ Gold ERP — Production Baseline Freeze & Operational Change Log

**Release Tag**: `v1.1.2-gold-audit-certified`  
**Git Branch**: `feature/production-v1.1.2`  
**Baseline Commit**: `09a848a`  
**Certified Target**: `https://aurum.arivahly.in`  
**Production Reference**: `https://maatarajewellers.shop` (Preserved & Protected)  
**Status**: **FROZEN FOR COMMERCIAL DEPLOYMENT**

---

## 1. Executive Freeze Declaration

As of **September 1, 2026**, the backend calculation engine, database invariant models, dual-currency billing pipeline, workshop craftsman books, universal print engine, and public document hosting platform are **officially frozen**.

Broad, unconstrained modifications to core architectural layers are suspended. Any subsequent modifications will follow the strict change management protocol defined in Section 4.

---

## 2. Core Architectural Invariants (Uncompromising Rules)

### **A. Gold-First Financial & Material Accounting**
1. **Gold / Fine Gold Primary**: Every sale, purchase, exchange, stock item, and ledger row maintains its exact pure gold weight in milligrams (`fine_mg` / `fineGoldMg`).
2. **Cash is Secondary & Derived**: Cash payments always record:
   $$\text{Cash Amount (\rupee)} + \text{Transaction Rate (\rupee/g)} \longrightarrow \text{Transaction-Time Gold Equivalent (mg)}$$
3. **Dual-Currency Balance**: Customers may hold both a Gold Balance (grams) and a Cash Balance (\rupee) without forced conversions unless an explicit Gold Settlement voucher is executed.

### **B. Karigar Physical Purity Custody (No Customer Fine Conversion)**
1. **Purity Isolation**: Karigar books for 22K (916), 18K (750), 14K (585), and 24K (999) are strictly independent running ledgers. Metal issued in 22K is settled in physical 22K metal or finished 22K jewellery.
2. **Gross Physical Custody is Authoritative**: The craftsman owes physical weight in that specific alloy.
3. **Fine Gold is Informational Only**: Any fine gold calculation displayed on craftsman screens is purely a derived statistical metric for central showroom metal valuation; it is **never** used to determine craftsman settlement or wage deduction.
4. **Wastage & Over-Loss**: Wastage percentages (Hisab) are computed strictly against the physical gross weight returned.

### **C. Invoicing & GST Compliance**
1. **GST Composition**: Taxable Base = Metal Value + Making Charges + Stone Charges + Hallmark Fees − Discounts.
2. **Statutory Tax**: CGST 1.5% + SGST 1.5% = 3.0% GST calculated to the exact paise.
3. **Old-Gold Exchange**: Old gold received during a sale is credited as a pure gold inflow at the prevailing purchase rate, reducing the payable cash balance or pure gold obligation.

### **D. Universal Print & Public Verification**
1. **One Engine, All Documents**: Vector rendering across A4, A5, 58mm/80mm Thermal receipts, and 2-up Jewellery Barcode tags.
2. **Unauthenticated Public Hosting**: Public document snapshots (`/doc/:token`) and QR verification (`/verify/invoice/:token`) operate securely with tenant isolation without exposing ERP administrative credentials.

---

## 3. Verified Performance & Volume Baseline

- **24-Month Dataset**: 750 Invoices, 1,200 Payments, 500 Karigar Custody entries, 200 Customer accounts, 20 Karigar masters.
- **In-Memory Compilation Latencies**:
  - Customer Running Account Ledger: `< 15ms`
  - Karigar Multi-Purity Custody Book: `< 10ms`
  - 2-Year Total Profit & Loss Report: `< 20ms`
  - Average Live Route Latency across 44 Business Hubs: `297ms`
- **Visual Evidence Catalog**: **114 full-resolution PNG artifacts** in `qa/audit-screenshots/`.

---

## 4. Known Non-Critical Nuances & Post-Launch Change Log

The following items are documented for post-launch monitoring and commercial operation:

| Item ID | Category | Description | Operational Handling | Classification |
| :--- | :--- | :--- | :--- | :--- |
| **KL-01** | UI / Display | Fine Gold display on Karigar screens | Purely informational statistical badge; gross physical weight remains primary | Working as Designed (Informational) |
| **KL-02** | Hardware | ESC/POS direct USB printing | Supported via Web Serial / Web Bluetooth API; fallback via Browser Vector Print | Standard Browser Security Model |
| **KL-03** | Storage | R2 image proxy latency on first upload | Cold start latency on Cloudflare Workers edge proxy (~350ms initial fetch, sub-50ms cached) | Expected Edge CDN Behavior |
| **KL-04** | Auth | Local mock tokens during offline testing | Offline fallback activates IndexedDB/LocalCache when remote Supabase connection is unreachable | High-Resilience Offline Mode |

---

## 5. Deployment & Release Integrity

* **Production Reference**: `https://maatarajewellers.shop` (Untouched baseline).
* **Active Staging / Beta Deployment**: `https://aurum.arivahly.in` (Verified HTTP 200 OK).
* **Consolidated Archive**: `C:\final erp 29.08\MTJ_AVS_GOLD_ERP_FULL_BACKUP_20260901.zip`.
* **Git Repository**: `https://github.com/Aritramanna1/avs-gold-erp` (`main` and `feature/production-v1.1.2`).
