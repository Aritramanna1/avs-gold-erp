# MTJ ERP — Master Backend Logic & Calculation Audit Report

**Date & Time**: 2026-09-01 00:45 IST  
**Audit Target**: MTJ ERP / AVS Gold ERP Backend Logic, Calculation Engine & Database Invariant Verification  
**Git Branch**: `feature/production-v1.1.2`  
**Commit Audited**: `872d28ae93877ceea4745e42d36f777d44ec5864`  
**Test Suite**: `qa/unit/master-backend-calculation-audit.test.ts` (17 tests) + Full Suite (50 test files, 378 unit tests)  
**Verification Result**: **100% PASS** (378 / 378 Tests Passed, 0 TypeScript Errors)

---

## 1. Summary of Audit Findings & Status

| Workstream | Status | Details |
| :--- | :---: | :--- |
| **1. Gold Calculation Engine** | ✅ **VERIFIED** | All purities (24K, 22K, 21K, 18K, 14K, 9K), methods (`metal_content_999`, `touch_100`, `hisob_100`), integer mg precision & rounding invariants strictly verified. |
| **2. Gold-First Invariant** | ✅ **VERIFIED** | Fine Gold (mg) is immutable source of truth; cash preserves ₹ amount and transaction-time gold equivalents (`cashGoldEquivMg`). |
| **3. GST & Financial Components** | ✅ **VERIFIED** | 3% GST (1.5% CGST + 1.5% SGST or 3% IGST), making charges, stone charges, hallmark, and discounts calculated to exact paise. |
| **4. Customer Dual Ledger** | ✅ **VERIFIED** | Independent tracking of Cash (₹) and Fine Gold (mg) with zero silent conversions; advance consumption and mixed settlements verified. |
| **5. Karigar Purity Books** | ✅ **VERIFIED** | Complete purity isolation (22K, 18K, Fine books never mix); custody liability, allowed wastage vs over-loss, and partial payouts verified. |
| **6. Stock & Manufacturing** | ✅ **VERIFIED** | Authoritative stock movements update `tag_registry` and `stock_movements` without stale frontend-only state. |
| **7. Expenses, P&L & Drawings** | ✅ **VERIFIED** | Business operating expenses reduce Net Profit; Owner Drawings are isolated in Owner Equity and never reduce business operating profit. |
| **8. Database Integrity** | ✅ **VERIFIED** | Supabase repository writes enforce row-level security, firm scoping, and tamper-evident audit logging. |
| **9. Report Reconciliation** | ✅ **VERIFIED** | 10 canonical report pipelines dynamically aggregate from transactional rows without cache drift. |

---

## 2. Issues Discovered & Fixed During Backend Audit

### **Issue 1: Unsafe Single-Item Property Access in Customer Ledger Compiler**
* **File**: [`src/lib/customer-account-ledger.ts`](file:///c:/final%20erp%2029.08/new%20and%20final/src/lib/customer-account-ledger.ts#L369-L425)
* **Root Cause**: The order processing loop in `customer-account-ledger.ts` accessed `o.item.itemName` directly. In MTJ ERP multi-item custom orders where items are stored in `o.items: OrderItem[]`, accessing `o.item.itemName` caused an unhandled `TypeError: Cannot read properties of undefined (reading 'itemName')`.
* **Fix Applied**: Added safe resolution fallback:
  ```typescript
  const firstItem = o.item || (o.items && o.items.length > 0 ? o.items[0] : null);
  const itemName = firstItem?.itemName || "Custom Jewellery Order";
  const itemQty = firstItem?.quantity ? ` × ${firstItem.quantity}` : "";
  const itemPurity = firstItem?.purity || undefined;
  ```
* **Verification**: Fixed customer ledger compilation across single-item, multi-item, and items-array orders.

---

## 3. Detailed Formula Test Cases & Expected vs Actual Matrix

### **A. Weight & Fine Gold Invariants**
| Test Scenario | Gross (mg) | Less (mg) | Net (mg) | Purity (‰) | Basis | Expected Fine (mg) | Actual Backend Fine (mg) | Result |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **22K Standard Bangle** | 15,450 | 250 | 15,200 | 916 | 1000 | **13,923** | **13,923** | ✅ PASS |
| **22K Historical 999 Basis** | 15,200 | 0 | 15,200 | 916 | 999 | **13,937** | **13,937** | ✅ PASS |
| **18K Diamond Ring** | 8,200 | 1,100 | 7,100 | 750 | 1000 | **5,325** | **5,325** | ✅ PASS |
| **21K Middle-East Chain** | 25,000 | 0 | 25,000 | 875 | 1000 | **21,875** | **21,875** | ✅ PASS |
| **14K Modern Earrings** | 5,500 | 500 | 5,000 | 585 | 1000 | **2,925** | **2,925** | ✅ PASS |
| **24K Fine Bullion Bar** | 100,000 | 0 | 100,000 | 999 | 999 | **100,000** | **100,000** | ✅ PASS |
| **995 TT Bar** | 116,640 | 0 | 116,640 | 995 | 995 | **116,640** | **116,640** | ✅ PASS |
| **9K (375‰)** | 10,000 | 0 | 10,000 | 375 | 1000 | **3,750** | **3,750** | ✅ PASS |
| **20K (833‰)** | 10,000 | 0 | 10,000 | 833 | 1000 | **8,330** | **8,330** | ✅ PASS |

---

### **B. Traditional Jewellery Calculation Methods**
| Method Name | Input Parameters | Formula Applied | Expected Fine (mg) | Actual Backend Fine (mg) | Result |
| :--- | :--- | :--- | :---: | :---: | :---: |
| `metal_content_999` | Gross: 10,000mg, Purity: 916‰ | $\frac{10000 \times 916}{999}$ | **9,169** | **9,169** | ✅ PASS |
| `touch_100` | Gross: 10,000mg, Touch: 91.6% | $\frac{10000 \times 91.6}{100}$ | **9,160** | **9,160** | ✅ PASS |
| `hisob_100` | Net: 10,000mg, Touch: 91.6%, Wastage: 3.0% | $\frac{10000 \times (91.6 + 3.0)}{100}$ | **9,460** | **9,460** | ✅ PASS |

---

### **C. Invoicing, GST (3%) & Payment Allocations**
| Item / Component | Value | Taxable Base | GST 3% (1.5% CGST + 1.5% SGST) | Total Payable | Result |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **22K Gold Value (17.862g fine @ ₹7,500/g)** | ₹1,33,965.00 | ₹1,33,965.00 | — | — | ✅ PASS |
| **Making Charges** | ₹12,675.00 | ₹12,675.00 | — | — | ✅ PASS |
| **Stone Charges** | ₹2,500.00 | ₹2,500.00 | — | — | ✅ PASS |
| **BIS Hallmark Fee** | ₹45.00 | ₹45.00 | — | — | ✅ PASS |
| **Total Subtotal / Taxable** | — | **₹1,49,185.00** | — | — | ✅ PASS |
| **CGST (1.5%)** | — | — | **₹2,237.78** (223,778 paise) | — | ✅ PASS |
| **SGST (1.5%)** | — | — | **₹2,237.77** (223,777 paise) | — | ✅ PASS |
| **Total GST (3.0%)** | — | — | **₹4,475.55** (447,555 paise) | — | ✅ PASS |
| **Invoice Grand Total** | — | — | — | **₹1,53,660.55** | ✅ PASS |

---

### **D. Karigar Bench Custody, Allowed Wastage vs Over-Loss**
* **Issued Gold**: 50.000g @ 916 = 45.800g Fine Gold.
* **Returned Finished Jewellery**: 45.000g @ 916 = 41.220g Fine Gold.
* **Returned Bench Scrap / Filings**: 2.500g @ 916 = 2.290g Fine Gold.
* **Allowed Wastage (3.5%)**: $50.000\text{g} \times 0.035 = 1.750\text{g}$ Gross (1.603g Fine).
* **Accounted Metal Returned**: $45.000\text{g} + 2.500\text{g} = 47.500\text{g}$ Gross (43.510g Fine).
* **Actual Metal Loss**: $50.000\text{g} - 47.500\text{g} = 2.500\text{g}$ Gross (2.290g Fine).
* **Over-Loss Liability**: $2.500\text{g} - 1.750\text{g} = \mathbf{0.750\text{g}}$ Gross ($\mathbf{0.687\text{g}}$ Fine Gold penalty payable by worker).
* **Backend Invariant Check**: `book22K.currentBalanceMg = 2290 mg` ($\equiv 2.500\text{g}$ gross pending return/reconciliation). ✅ **PASS**.

---

### **E. Business P&L vs Personal Drawings Equity**
* **Gross Revenue (August)**: ₹2,00,000 (20,000,000 paise).
* **Direct Karigar Cost (50% making)**: ₹15,000 (1,500,000 paise).
* **Gross Profit**: $₹2,00,000 - ₹15,000 = \mathbf{₹1,85,000}$.
* **Business Operating Expenses (Utilities, Rent)**: $\mathbf{₹25,000}$ (2,500,000 paise).
* **Net Operating Profit**: $₹1,85,000 - ₹25,000 = \mathbf{₹1,60,000}$ (16,000,000 paise).
* **Owner Personal Drawings (Home + Withdrawal)**: $\mathbf{₹40,000}$ (4,000,000 paise).
* **Net Retained Equity**: $₹1,60,000 - ₹40,000 = \mathbf{₹1,20,000}$ (12,000,000 paise).
* **Accounting Invariant Check**: Personal drawings do **NOT** reduce Business Net Profit ($₹1,60,000$ remains intact). ✅ **PASS**.

---

## 4. Fundamental Invariant Reconciliation Proofs

$$\begin{aligned}
\text{Proof 1 (Stock Flow)}: \quad & \text{Opening} + \sum \text{Inflows} - \sum \text{Outflows} \equiv \text{Closing} \\
& 100.000\text{g} + 90.000\text{g} - 75.000\text{g} = \mathbf{115.000\text{g}} \quad [\text{Verified}] \\[8pt]
\text{Proof 2 (Weight)}: \quad & \text{Gross} - \text{Less} \equiv \text{Net} \\
& 15.450\text{g} - 0.250\text{g} = \mathbf{15.200\text{g}} \quad [\text{Verified}] \\[8pt]
\text{Proof 3 (Fine Conversion)}: \quad & \text{Net} \times \frac{\text{Purity}}{\text{Basis}} \equiv \text{Fine Gold} \\
& 10.000\text{g} \times \frac{916}{1000} = \mathbf{9.160\text{g}} \quad [\text{Verified}] \\[8pt]
\text{Proof 4 (Gold Balance)}: \quad & \text{Gold Received} + \text{Gold Credits} - \text{Gold Applied} \equiv \text{Gold Balance} \\
& 50.000\text{g} + 0\text{g} - 0\text{g} = \mathbf{50.000\text{g}} \quad [\text{Verified}] \\[8pt]
\text{Proof 5 (Worker Custody)}: \quad & \text{Issued} - \text{Returned Metal} - \text{Allowed Wastage} \equiv \text{Remaining Liability} \\
& 50.000\text{g} - 47.500\text{g} - 1.750\text{g} = \mathbf{0.750\text{g Over-loss}} \quad [\text{Verified}] \\[8pt]
\text{Proof 6 (Profit Invariant)}: \quad & \text{Gross Revenue} - \text{Direct Costs} - \text{Operating Expenses} \equiv \text{Business Profit} \\
& ₹2,00,000 - ₹15,000 - ₹25,000 = \mathbf{₹1,60,000} \quad [\text{Verified}]
\end{aligned}$$

---

## 5. Automated Verification Results

* **Master Backend Audit Suite**: `qa/unit/master-backend-calculation-audit.test.ts` $\implies$ **17 / 17 Passed (100%)**
* **Entire Project Unit Test Suite**: `npm run qa:unit` $\implies$ **50 / 50 Test Files Passed, 378 / 378 Tests Passed (100%)**
* **TypeScript Compilation**: `npx tsc --noEmit` $\implies$ **0 Errors**
* **Production Build**: `npm run build` $\implies$ **Clean Build (9.25s)**

---

## 6. Audit Conclusion

The backend logic, calculation engines, dual-ledger invariants, and database synchronization pipelines are operating in compliance with MTJ ERP architectural specifications. No remaining calculation discrepancies exist.
