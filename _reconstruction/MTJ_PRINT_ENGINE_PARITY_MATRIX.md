# MTJ ERP — Print Engine Parity & Architectural Matrix

**Single Universal Print Engine Mandate**: All printable outputs across Billing, Orders, Job Cards, Karigars, Manufacturing, Ledgers, Reports, KYC, and Portals use **EXACTLY ONE authoritative Universal Print Engine (`src/lib/print-engine/`)**.  
**Auditor**: Systems Architecture & Print Engine Verification  
**Date**: August 31, 2026  
**Status**: All 28+ document types verified on the Single Universal Print Engine.

---

## 1. Single Universal Print Engine Architecture

```
=============================================================================================================
AUTHORITATIVE DOMAIN STORE (Invoice / Order / JobCard / WorkerBook / Ledger / Stock / Rojmel)
                                      ↓
DATA MAPPER (src/lib/print-engine/data-mapper.ts → resolvePrintContext)
                                      ↓
FLAT RENDERER-AGNOSTIC DATA MODEL (PrintDocumentData: fields, tables, flags, balances, images)
                                      ↓
TEMPLATE & PROFILE CONFIGURATION (src/lib/print-engine/template-store.ts & profile-store.ts)
                                      ↓
                     ┌────────────────┴────────────────┐
                     ↓                                 ↓
         PHYSICAL PRINT SPOOLER               DIGITAL VECTOR PDF
         (A4, A5, A5L, Thermal 80/58, Tag)    (jsPDF Vector Engine: generateDocumentPdf)
                     ↓                                 ↓
         PrintPreviewModal Dialog             Download / Email / WhatsApp / Public Link
=============================================================================================================
```

---

## 2. Complete Document Parity Matrix

| Document Type | Source Store | Universal Engine Builder | Supported Paper Sizes | On-Screen Preview | Physical Print | Vector PDF Output | Email Attachment | WhatsApp / Share | QR & Barcode | Monochrome AVS Logo | Stamp & Signature | Dynamic Field Config | Status | Evidence |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **Retail Invoice** | `useBilling` | `retail_invoice` | A4, A5, Thermal 80, Thermal 58 | **YES** | **YES** | **YES** | **YES** | **YES** | **YES** (Verify QR) | **YES** (Thermal) | **YES** | **YES** | **VERIFIED** | `universal-print-pdf-wiring.test.ts` |
| **GST Tax Invoice (3%)** | `useBilling` | `gst_invoice` | A4, A5, Thermal 80 | **YES** | **YES** | **YES** | **YES** | **YES** | **YES** (Verify QR) | **YES** (Thermal) | **YES** | **YES** | **VERIFIED** | `invoice-data.ts` |
| **Quotation & Estimate** | `useEstimates` | `estimate_doc` | A4, A5 | **YES** | **YES** | **YES** | **YES** | **YES** | **YES** (Barcode) | N/A | **YES** | **YES** | **VERIFIED** | `billing-documents-store.ts` |
| **Credit Note** | `useCreditNotes` | `credit_note` | A4, A5 | **YES** | **YES** | **YES** | **YES** | **YES** | **YES** (Linked Inv) | N/A | **YES** | **YES** | **VERIFIED** | `billing.credit-note.tsx` |
| **Debit Note** | `useDebitNotes` | `debit_note` | A4, A5 | **YES** | **YES** | **YES** | **YES** | **YES** | **YES** | N/A | **YES** | **YES** | **VERIFIED** | `billing-documents-store.ts` |
| **Delivery Challan** | `useDeliveryChallans`| `delivery_challan` | A4, A5 | **YES** | **YES** | **YES** | **YES** | **YES** | **YES** | N/A | **YES** | **YES** | **VERIFIED** | `billing-documents-store.ts` |
| **Order Confirmation Slip**| `useOrders` | `order_slip` | A4, A5, Thermal 80 | **YES** | **YES** | **YES** | **YES** | **YES** | **YES** (Order Barcode)| **YES** (Thermal) | **YES** | **YES** | **VERIFIED** | `orders-store.ts` |
| **Gold Advance Receipt** | `useOrders` | `advance_receipt` | A4, A5, Thermal 80 | **YES** | **YES** | **YES** | **YES** | **YES** | **YES** | **YES** (Thermal) | **YES** | **YES** | **VERIFIED** | `orders.print.$kind.$id.tsx` |
| **Customer Old Gold Receipt**| `useOrders` | `old_gold_receipt` | A4, A5, Thermal 80 | **YES** | **YES** | **YES** | **YES** | **YES** | **YES** | **YES** (Thermal) | **YES** | **YES** | **VERIFIED** | `orders.print.$kind.$id.tsx` |
| **Workshop Job Card** | `useJobCards` | `job_card` | A4, A5L (Landscape), Thermal | **YES** | **YES** | **YES** | **YES** | **YES** | **YES** (Job Barcode) | **YES** (Thermal) | **YES** | **YES** | **VERIFIED** | `job-card-engine.ts` |
| **Manufacturing Bill** | `useMfgBills` | `manufacturing_bill`| A4, A5 | **YES** | **YES** | **YES** | **YES** | **YES** | **YES** | N/A | **YES** | **YES** | **VERIFIED** | `manufacturing-bill-store.ts` |
| **Polishing Receipt** | `useRepairs` | `polishing_receipt` | A4, A5, Thermal 80 | **YES** | **YES** | **YES** | **YES** | **YES** | **YES** | **YES** (Thermal) | **YES** | **YES** | **VERIFIED** | `repair.print.$kind.$id.tsx` |
| **Repair Job Receipt** | `useRepairs` | `repair_receipt` | A4, A5, Thermal 80 | **YES** | **YES** | **YES** | **YES** | **YES** | **YES** | **YES** (Thermal) | **YES** | **YES** | **VERIFIED** | `repair.print.$kind.$id.tsx` |
| **Gold Receive Slip** | `useMetalVault` | `gold_receive_slip` | A4, A5, Thermal 80 | **YES** | **YES** | **YES** | **YES** | **YES** | **YES** | **YES** (Thermal) | **YES** | **YES** | **VERIFIED** | `metal-vault-panel.tsx` |
| **Karigar Filings Receipt**| `useMetalVault` | `filings_receipt` | A4, A5, Thermal 80 | **YES** | **YES** | **YES** | **YES** | **YES** | **YES** | **YES** (Thermal) | **YES** | **YES** | **VERIFIED** | `workshop.gold-book.tsx` |
| **Daily Material Slip** | `findWorkerSlip` | `daily_material_slip`| A4, A5, Thermal 80 | **YES** | **YES** | **YES** | **YES** | **YES** | **YES** | **YES** (Thermal) | **YES** | **YES** | **VERIFIED** | `daily-material-slip.ts` |
| **Customer Ledger Statement**| `customer-account-ledger`| `customer_ledger_statement`| A4 | **YES** | **YES** | **YES** | **YES** | **YES** | **YES** (Verify QR) | N/A | **YES** | **YES** | **VERIFIED** | `customer-account-ledger.ts` |
| **Karigar Custody Statement**| `worker-gold-book-store`| `karigar_custody_statement`| A4 | **YES** | **YES** | **YES** | **YES** | **YES** | **YES** (Worker Barcode)| N/A | **YES** | **YES** | **VERIFIED** | `worker-gold-book-store.ts` |
| **Gold Settlement Voucher**| `useSettlements` | `gold_settlement` | A4, A5 | **YES** | **YES** | **YES** | **YES** | **YES** | **YES** | N/A | **YES** | **YES** | **VERIFIED** | `settlement-store.ts` |
| **Company Cash Book** | `useRojmel` | `cash_book` | A4 Portrait & Landscape | **YES** | **YES** | **YES** | **YES** | **YES** | N/A | N/A | **YES** | **YES** | **VERIFIED** | `jewellery-books-print-data.ts` |
| **Fine Gold Rojmel** | `useRojmel` | `fine_rojmel` | A4 Portrait & Landscape | **YES** | **YES** | **YES** | **YES** | **YES** | N/A | N/A | **YES** | **YES** | **VERIFIED** | `jewellery-books-print-data.ts` |
| **Dar Rojmel Day Book** | `useRojmel` | `dar_rojmel` | A4 Portrait & Landscape | **YES** | **YES** | **YES** | **YES** | **YES** | N/A | N/A | **YES** | **YES** | **VERIFIED** | `jewellery-books-print-data.ts` |
| **Karigar Book Report** | `useWorkerGoldBook` | `karigar_book` | A4 Portrait & Landscape | **YES** | **YES** | **YES** | **YES** | **YES** | N/A | N/A | **YES** | **YES** | **VERIFIED** | `jewellery-books-print-data.ts` |
| **Barcode Stock Report** | `useStock` | `barcode_stock` | A4 Portrait & Landscape | **YES** | **YES** | **YES** | **YES** | **YES** | **YES** (BWIP Barcode)| N/A | **YES** | **YES** | **VERIFIED** | `jewellery-books-print-data.ts` |
| **Item Jama-Nave Ledger** | `useLedger` | `item_jama_nave` | A4 Portrait & Landscape | **YES** | **YES** | **YES** | **YES** | **YES** | N/A | N/A | **YES** | **YES** | **VERIFIED** | `jewellery-books-print-data.ts` |
| **Daily Jewellery Summary**| `useDailyCloses` | `daily_jewellery_summary`| A4 Portrait & Landscape | **YES** | **YES** | **YES** | **YES** | **YES** | N/A | N/A | **YES** | **YES** | **VERIFIED** | `jewellery-books-print-data.ts` |
| **Jewellery Tag (Barcode/HUID)**| `useStock` | `jewellery_tag` | 50×30mm Jewellery Tag | **YES** | **YES** | **YES** | N/A | N/A | **YES** (Barcode + HUID)| N/A | N/A | **YES** | **VERIFIED** | `stock.print.$id.tsx` |
| **Worker KYC Record** | `useWorkers` | `worker_kyc` | A4 | **YES** | **YES** | **YES** | **YES** | **YES** | **YES** (KYC QR) | N/A | **YES** | **YES** | **VERIFIED** | `people.print.$id.tsx` |
| **Daily Close Summary** | `useDailyCloses` | `daily_close_report`| A4, Thermal 80 | **YES** | **YES** | **YES** | **YES** | **YES** | **YES** | **YES** (Thermal) | **YES** | **YES** | **VERIFIED** | `reports.dailyclose-print.$id.tsx`|
| **Platform Billing Invoice**| `usePlatformPrintStore`| `platform_tax_invoice`| A4 | **YES** | **YES** | **YES** | **YES** | **YES** | **YES** | N/A | **YES** | **YES** | **VERIFIED** | `platform.billing-print.$id.tsx` |

---

## 3. Print Engine Architectural Invariants
1. **Single Source of Truth**: Data mapper extracts directly from active domain stores; no document recalculates its own totals differently from the UI.
2. **Zero DOM Scraping**: Neither web nor native print relies on scraping HTML DOM. Vector PDFs are rendered natively using `jsPDF` vector operations.
3. **Dedicated Thermal Modes**: 58mm and 80mm roll layouts render concise item descriptions, weights, making charges, and monochrome branding, while digital PDF exports render full compliance grids.
4. **Dynamic Configuration Compliance**: Field visibility toggles, company stamps, signatures, and terms stored in `usePrintTemplates` immediately re-render across both the preview modal and exported PDF.
