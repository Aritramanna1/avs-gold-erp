# ORNEXA — BUSINESS RULES & FORMULA MASTER
**Authoritative Calculation, Accounting & Compliance Rules**
*Version: 3.0.0 (Approved Source of Truth)*
*Last Updated: August 2026*

---

## 1. System Invariants vs. Business Configuration

To ensure absolute enterprise stability, Ornexa strictly divides all system behavior into **System Invariants** (hardcoded, non-negotiable security/accounting rules) and **Business Configuration** (user-defined rules, formulas, and parameters):

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            SYSTEM INVARIANTS                                │
│  (Hard boundaries enforced by backend, RLS, DB schema & double-entry math)  │
├─────────────────────────────────────────────────────────────────────────────┤
│  • Strict Multi-Tenant Isolation                                            │
│  • Immutable Transaction & Audit Logs (No destructive deletes)              │
│  • Dual-Ledger Double-Entry Balanced Books (Metal & Currency)               │
│  • Historical Transaction Snapshot Integrity (Old bills never recalculate)  │
│  • Statutory GST & Tax Integrity (Intra-state vs Inter-state)                │
│  • Role-Based Access Control & Permission Gates                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          BUSINESS CONFIGURATION                             │
│   (No-code configuration customized by authorized tenant administrators)    │
├─────────────────────────────────────────────────────────────────────────────┤
│  • Making Charge Formulas (Per gram gross, net, piece, %, slab)             │
│  • Karigar Labour Wage Rules & Wastage (Ghat) Percentages                   │
│  • Process Stages & Workshop Routing Sequences                              │
│  • Payment Terms, Credit Days & Grace Periods                               │
│  • Custom Attributes, Custom Categories & Custom Fields                     │
│  • Document Print Profiles, Templates & Terms Hierarchy                     │
│  • Terminology Aliases (e.g. "Karigar" vs "Worker" vs "Artisan")            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Dual-Currency & Dual-Commodity Accounting

Every transaction in Ornexa tracks two completely independent balance dimensions:

1. **Pure Metal Dimension (Fine Gold / Silver in Milligrams - mg):**
   - Base integer unit: `1 milligram = 0.001 gram`.
   - Conversion: `Fine Weight (mg) = Net Weight (mg) × (Purity % / 100)`.
   - Never mixed with money; settled in physical metal or rate-cut cash conversions.
2. **Financial Dimension (Indian Rupees in Paise):**
   - Base integer unit: `1 Paise = ₹0.01` (Prevents floating-point rounding errors).
   - Tracks debit/credit money balances, advance deposits, making charges, and taxes.

---

## 3. Formula Engine & Versioned Calculations

All commercial calculations use the versioned **Formula Engine**. When an invoice, job card, or settlement voucher is posted, the active formula and calculation snapshot are frozen into the transaction record.

### 3.1 Labour / Making Charge Calculation Modes
Ornexa supports 6 configurable calculation models:
1. **Per Gram Gross Weight:** `Charge = Gross Weight (g) × Rate per Gram`.
2. **Per Gram Net Weight:** `Charge = (Gross Weight - Stone Weight) (g) × Rate per Gram`.
3. **Per Piece / Fixed Rate:** `Charge = Flat Item Rate × Quantity`.
4. **Percentage of Gold Value:** `Charge = (Fine Gold Weight × Live Gold Rate) × (Making % / 100)`.
5. **Slab-Based / Weight Range:** Rate per gram depends on the finished weight bucket (e.g. 0–5g @ ₹650/g, 5–15g @ ₹550/g).
6. **Compound / Component-Based:** Separate making charges for base casting + hand engraving + stone setting per stone.

### 3.2 Karigar Wastage (Ghat) Allowance Rules
1. **Percentage Wastage Allowance:** `Allowed Loss (mg) = Issued Fine Metal (mg) × (Wastage % / 100)`.
2. **Fixed Wastage per Piece:** Flat milligrams allowed per finished article.
3. **Zero-Loss Contract:** Karigar is accountable for 100.000% of issued fine metal; any loss is debited to their metal ledger.

---

## 4. Due Date, Credit Terms & Aging Controls

Ornexa enforces disciplined credit management across all B2B accounts:

| Payment Term | Description | Due Date Computation |
|---|---|---|
| **Immediate** | Cash / Spot settlement required upon invoice generation. | `Due Date = Invoice Date` |
| **7 Days** | Standard weekly credit for trusted wholesale buyers. | `Due Date = Invoice Date + 7 Days` |
| **15 Days** | Bi-weekly trade credit. | `Due Date = Invoice Date + 15 Days` |
| **30 Days** | Monthly commercial cycle. | `Due Date = Invoice Date + 30 Days` |
| **Custom** | Explicit date selected on the invoice. | `Due Date = Custom Input Date` |

### 4.1 Due Status Progression
- **Current:** Invoice within terms (`Today <= Due Date`).
- **Grace Period:** Invoice within configured grace window (e.g., 3 days post due date).
- **Overdue:** Invoice past due date (`Today > Due Date + Grace`). Automatically triggers high-priority alerts and blocks fresh credit order creation if configured.

---

## 5. Tax, GST & State Master Compliance

### 5.1 Place of Supply & Tax Treatment
All tax calculations strictly check the **Seller State Code** (Firm/Branch) vs **Buyer State Code** (Customer/Party):
- **Intra-State Transaction (`Seller State == Buyer State`):**
  - Jewellery GST: `CGST 1.5% + SGST 1.5% = Total 3.0%`.
  - Job-Work Labour GST: `CGST 2.5% + SGST 2.5% = Total 5.0%` (or 18% for unregistered).
- **Inter-State Transaction (`Seller State != Buyer State`):**
  - Jewellery GST: `IGST 3.0%`.
  - Job-Work Labour GST: `IGST 5.0%` (or 18%).
- **Export / SEZ:** `Zero-Rated (LUT Bond)` or `IGST with Refund Claim`.

### 5.2 Mandatory State Code Master
Every party must have:
- `State Name` (e.g., West Bengal, Maharashtra, Gujarat).
- `2-Digit State Code` (e.g., 19 for WB, 27 for MH, 24 for GJ).
- `Place of Supply` explicitly stated on all B2B invoices.

---

## 6. Period Lock, Freeze Date & Close Procedures

1. **Daily Day-Close:** Reconciles physical vault count against system balances, checks unposted drafts, verifies open cash drawers, and generates daily variance reports.
2. **Financial Freeze Date:** Authorized tenant administrators can lock transactions prior to a specific date (e.g. Year-End 31st March or GST filing freeze). Any attempt to edit, backdate, or delete transactions before the freeze date is blocked by database triggers.
3. **Reversal Protocol:** Posted transactions can never be deleted. Corrections must be made via formal **Reversal Transactions** or **Credit/Debit Notes** with mandatory reason and manager approval.

---

## 7. No Dead Buttons / No Dead Modules Standard

> **"If an authorized user can see a button or menu, it must work end-to-end. If a feature is disabled by plan or permission, it must be hidden or clearly display an explanation."**

- No dummy buttons that do nothing when clicked.
- No placeholder "Coming Soon" dialogs in production flows.
- Every form must submit to real Supabase tables or RPC functions.
