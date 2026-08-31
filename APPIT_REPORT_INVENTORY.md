# APPIT Jewel ERP — Report Inventory

**Date:** 2026-08-12

This document catalogs the analytical and compliance reports observed inside the APPIT Jewel ERP platform.

---

## 1. Sales & Billing Reports

### R-001: Sales Register

- **Purpose**: List of all retail tax invoices generated within a period.
- **Columns**: Invoice Number, Date, Customer Name, Items Qty, Subtotal, Tax (GST), Discounts, Grand Total, Payment Mode, Created By.
- **Filters**: Date range, Branch, Payment Mode (Cash/Card/UPI/Split), Created By.
- **Grouping**: Group by Date, Group by Payment Mode.

### R-002: Sales Return Register

- **Purpose**: List of return/exchange credit notes.
- **Columns**: Credit Note No, Date, Original Invoice No, Customer, Returned Weight, Refunded Cash, Exchange Value.
- **Filters**: Date range, Branch.

---

## 2. Inventory Reports

### R-003: Stock Valuation Report

- **Purpose**: Valuation of current physical stock based on daily metal rates.
- **Columns**: Category, Item Description, Barcode Tag, Gross Wt, Net Wt, Purity (Karat), Gold Value (Live), Stone Value, Total Valuation.
- **Filters**: Branch, Category, Metal, Purity.
- **Totals**: Sum of Gross Wt, Sum of Net Wt, Sum of live valuation.

### R-004: Metal Ledger & Balance Sheet

- **Purpose**: Daily running balance of raw metal in main vaults and branch registers.
- **Columns**: Date, Reference Transaction (GRN / Issued / Returned / Refinery), Metal (Gold/Silver), Incoming (g), Outgoing (g), Balance (g).
- **Filters**: Metal type, Purity, Branch, Date range.

---

## 3. Manufacturing Reports

### R-005: Karigar Balance Report

- **Purpose**: Outstanding gold weight held by Karigars on their benches.
- **Columns**: Karigar Name, Opening Balance (g), Metal Issued (g), Metal Returned (g), Wastage Allowed (g), Actual Wastage (g), Outstanding Balance (g).
- **Filters**: Karigar select, Branch.
- **Totals**: Consolidated outstanding gold weight across all workshops.

### R-006: Job Card Status & Aging Report

- **Purpose**: Progress tracking of active workshop production cards.
- **Columns**: Job Card No, Date Created, Karigar, Stage, Expected Completion, Delay Days, Priority.
- **Filters**: Stage (Design/Metal Issue/Karigar Work/Polishing/QC), Karigar, Delay Status.

---

## 4. Financial & Compliance Reports

### R-007: Day Book

- **Purpose**: Reconcile daily transactions and vault status.
- **Columns**: Date, Opening Cash Balance, Total Cash Receipts, Total Cash Payments, Closing Cash Balance.
- **Filters**: Branch, Date.

### R-008: GST Return Reports (GSTR-1 & GSTR-2)

- **Purpose**: GST filings extraction.
- **Columns**: Invoice No, Customer GSTIN, Taxable Value, CGST (1.5%), SGST (1.5%), IGST (3%), Total Invoice Value.
- **Filters**: Month, Quarter, Branch.
- **Export**: CSV / JSON format for government filing portal.
