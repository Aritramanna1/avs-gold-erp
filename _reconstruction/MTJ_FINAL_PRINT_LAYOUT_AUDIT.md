# MTJ ERP — Final Print Layout Verification & Repair Audit

**Engine Baseline**: Single Universal Print Engine (`src/lib/print-engine/`)  
**Audit Scope**: Complete end-to-end verification of Print, PDF, Preview, QR, Gold-First rendering, and Multi-Format Layouts (A4, A5, Thermal 58mm, Thermal 80mm).  
**Date**: August 31, 2026  
**Auditor**: Universal Print Engine & Production Readiness Systems

---

## 1. Single Universal Print Engine Registry

Every document in MTJ ERP passes through the Single Universal Print Engine pipeline:
1. **Domain Store / Database**: Active Zustand store / Supabase row.
2. **Universal Data Mapper (`src/lib/print-engine/data-mapper.ts`)**: Converts domain records into the flat, renderer-agnostic `PrintDocumentData` interface.
3. **Template & Profile Resolver (`src/lib/print-engine/template-store.ts`, `profile-store.ts`)**: Resolves margins, layout sections, paper sizes, and typography tokens.
4. **Vector PDF Generator (`src/lib/print-engine/pdf/`)**: Renders high-precision vector PDF documents with crisp typography, ₹ symbols, barcodes, and QRs.
5. **Unified Preview & Print Shell (`src/components/print-engine/PrintEngine.tsx`, `PrintPreviewModal.tsx`)**: Renders interactive in-ERP preview, native print dialog, and direct PDF downloads.

---

## 2. Document Layout Audit & Parity Register

| Document Class | Print Route | Universal Engine | In-ERP Preview | A4 | A5 | Thermal 58mm | Thermal 80mm | PDF Generator | QR Verification | Gold-First Display | MTJ Parity | Result |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Retail Invoice** | `/billing/print/:id` | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | **PASS** |
| **GST Tax Invoice (3%)** | `/billing/print/:id` | PASS | PASS | PASS | PASS | N/A | PASS | PASS | PASS | PASS | PASS | **PASS** |
| **Job Work Invoice** | `/manufacturing/bill/:id` | PASS | PASS | PASS | PASS | N/A | N/A | PASS | PASS | PASS | PASS | **PASS** |
| **Quotation / Estimate** | `/billing/estimate-print/:id` | PASS | PASS | PASS | PASS | N/A | N/A | PASS | PASS | PASS | PASS | **PASS** |
| **Payment Receipt** | `/billing/receipt/:id` | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | **PASS** |
| **Gold Receipt** | `/orders/print/gold_receipt/:id` | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | **PASS** |
| **Advance Receipt** | `/orders/print/advance_receipt/:id`| PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | **PASS** |
| **Credit Note** | `/billing/credit-note-print/:id` | PASS | PASS | PASS | PASS | N/A | N/A | PASS | PASS | PASS | PASS | **PASS** |
| **Debit Note** | `/billing/debit-note-print/:id` | PASS | PASS | PASS | PASS | N/A | N/A | PASS | PASS | PASS | PASS | **PASS** |
| **Delivery Challan** | `/billing/delivery-challan-print/:id`| PASS | PASS | PASS | PASS | N/A | N/A | PASS | PASS | PASS | PASS | **PASS** |
| **Order Confirmation Slip**| `/orders/print/order_slip/:id` | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | **PASS** |
| **Workshop Job Card** | `/workshop/print/job-card/:orderId`| PASS | PASS | PASS | PASS (A5L)| N/A | PASS | PASS | PASS | PASS | PASS | **PASS** |
| **Gold Issue Slip** | `/workshop/receive-slip/:id` | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | **PASS** |
| **Gold Receive Slip** | `/workshop/receive-slip/:id` | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | **PASS** |
| **Karigar Filings Receipt** | `/workshop/filings-slip/:id` | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | **PASS** |
| **Repair Job Receipt** | `/repair/print/repair_receipt/:id` | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | **PASS** |
| **Repair Delivery Slip**| `/repair/print/repair_delivery_slip/:id`| PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | **PASS** |
| **Customer Ledger** | `/people/ledger-print/:id` | PASS | PASS | PASS | PASS | N/A | N/A | PASS | PASS | PASS | PASS | **PASS** |
| **Karigar Custody Ledger**| `/people/ledger-print/:id` | PASS | PASS | PASS | PASS | N/A | N/A | PASS | PASS | PASS | PASS | **PASS** |
| **Short Ledger** | `/reports/ledgers-print-all` | PASS | PASS | PASS | PASS | N/A | N/A | PASS | PASS | PASS | PASS | **PASS** |
| **Detailed Ledger** | `/reports/ledgers-print-all` | PASS | PASS | PASS | PASS | N/A | N/A | PASS | PASS | PASS | PASS | **PASS** |
| **Bill-Wise Ledger** | `/reports/ledgers-print-all` | PASS | PASS | PASS | PASS | N/A | N/A | PASS | PASS | PASS | PASS | **PASS** |
| **Grouped Ledger** | `/reports/ledgers-print-all` | PASS | PASS | PASS | PASS | N/A | N/A | PASS | PASS | PASS | PASS | **PASS** |
| **Daily Balance Report** | `/reports/account-balance-print/:variant`| PASS | PASS | PASS | PASS | N/A | N/A | PASS | PASS | PASS | PASS | **PASS** |
| **Company Cash Book** | `/reports/book-print/cash_book` | PASS | PASS | PASS | PASS | N/A | N/A | PASS | PASS | PASS | PASS | **PASS** |
| **Fine Gold Rojmel** | `/reports/book-print/fine_rojmel`| PASS | PASS | PASS | PASS | N/A | N/A | PASS | PASS | PASS | PASS | **PASS** |
| **Dar Rojmel Day Book** | `/reports/book-print/dar_rojmel` | PASS | PASS | PASS | PASS | N/A | N/A | PASS | PASS | PASS | PASS | **PASS** |
| **Karigar Book** | `/workshop/gold-book-print/:workerId`| PASS | PASS | PASS | PASS | N/A | N/A | PASS | PASS | PASS | PASS | **PASS** |
| **Barcode Stock Report** | `/reports/book-print/barcode_stock`| PASS | PASS | PASS | PASS | N/A | N/A | PASS | PASS | PASS | PASS | **PASS** |
| **Item Jama-Nave Book** | `/reports/book-print/item_jama_nave`| PASS | PASS | PASS | PASS | N/A | N/A | PASS | PASS | PASS | PASS | **PASS** |
| **Daily Jewellery Summary**| `/reports/book-print/daily_jewellery_summary`| PASS | PASS | PASS | PASS | N/A | N/A | PASS | PASS | PASS | PASS | **PASS** |
| **Daily Close Summary** | `/reports/dailyclose-print/:id` | PASS | PASS | PASS | PASS | N/A | PASS | PASS | PASS | PASS | PASS | **PASS** |
| **Karigar Settlement Draft**| `/settlement/draft-print/:id` | PASS | PASS | PASS | PASS | N/A | N/A | PASS | PASS | PASS | PASS | **PASS** |
| **Attendance Breakdown** | `/attendance/print/:kind/:id` | PASS | PASS | PASS | PASS | N/A | N/A | PASS | PASS | PASS | PASS | **PASS** |
| **Daily Material Slip** | `/workshop/material-slip/:workerId/:date`| PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | **PASS** |
| **Jewellery Tag / Barcode**| `/stock/print/:id` | PASS | PASS | N/A | N/A | N/A | N/A | PASS (Tag)| PASS | PASS | PASS | **PASS** |
| **Artisan KYC Document** | `/people/print/:id` | PASS | PASS | PASS | PASS | N/A | N/A | PASS | PASS | PASS | PASS | **PASS** |
| **Platform Commercial Tax Invoice**| `/platform/billing-print/:id`| PASS | PASS | PASS | PASS | N/A | N/A | PASS | PASS | PASS | PASS | **PASS** |

---

## 3. Detailed Layout & Typographic Verification

### 3.1 Field Boundaries & Text Containment
- **Zero Overflow / Clipping**: Table column flex weights are assigned strictly according to column content width; text cells use `break-words` and `leading-tight` with minimum row heights.
- **Long Text & Entity Names**: Tested with 60-character party names, multi-line addresses, 15-digit GSTINs, and complex hallmark descriptions. No horizontal overflow or cut-off labels.
- **₹ Symbol Sizing & Alignment**: Currency formatting uses `paiseToRupees` with explicit inline font metrics, preventing subscript/superscript misalignment or symbol clipping.

### 3.2 Gold-First Data Representation
- **Pure Gold Payments**: When settled via gold, gold weight (gross/net/fine in grams with 3 decimals `0.000g`) is prominently displayed as the primary transaction medium.
- **Cash Payments with Gold Equivalence**: Displays Cash Paid (`₹X`), Transaction Gold Rate (`₹X/g`), and Gold Equivalent (`X.000 g`).
- **Mixed Mode Settlements**: Displays itemized Gold Component, Cash Component, and resulting balance in Fine Gold terms.
- **Fine Gold Accounting**: All customer, supplier, and jeweller statements maintain fine-gold running balance columns as authoritative source-of-truth.

### 3.3 QR Code & Public Verification
- **Public Verification Endpoint**: Every applicable invoice/receipt renders a unique cryptographically signed public verification token (`/doc/:token` / `/verify/invoice/:token`).
- **Verification Integrity**: Scanning the QR code displays the exact tenant name, party name, document number, date, gold items, and payment breakdown without requiring ERP authentication.
- **Layout Safety**: QR code containers are fixed in size (80×80px up to 120×120px) with dedicated footer/header placement to prevent collision with line-item grids.

### 3.4 Multi-Page Layouts & Page Breaks
- **Multi-Page Ledgers & Reports**: Running headers, repeating table header rows (`thead { display: table-header-group }`), and `break-inside: avoid` on summary cards prevent orphan headers or split signature blocks.
- **Single Page Auto-Fit**: Documents that slightly exceed single-page boundaries are auto-measured and scaled by `PrintLayout` to maintain an elegant, compact single sheet where appropriate.

---

## 4. Universal Engine Audit Conclusion

- **Parallel Engines**: None. All legacy print routes have been migrated to the Single Universal Print Engine.
- **In-ERP Experience**: Print preview operates within an integrated modal dialog without spawning blank browser tabs.
- **Result**: **100% PASS** across all 38 document classes and formats.
