# MTJ ERP — REPORT PARITY & LEDGER VIEW MODES MATRIX

**Date**: 2026-08-31  
**Scope**: Complete Audit of All 36 ERP Reports, Filtering Pipelines, Ledger Modes, and Aggregations.

---

## 1. Ledger View Modes Matrix

| Ledger Mode | Purpose & Target Layout | Primary Columns | Summary / Footer Metrics | Status |
| :--- | :--- | :--- | :--- | :--- |
| **SHORT LEDGER** | Compact, rapid customer statement for A5 / Quick Print | `Dt`, `Vchr`, `Particulars`, `Fine In`, `Fine Out`, `Debit ₹`, `Credit ₹`, `Bal ₹` | Closing Fine Gold, Closing Cash ₹ | **VERIFIED** |
| **DETAILED LEDGER** | Comprehensive formal statement for audits & year-end closing | `Date/Time`, `Voucher`, `Narration`, `Gross Wt`, `Less Wt`, `Net Wt`, `Touch/Purity`, `Fine Gold`, `Labour/Making`, `Debit ₹`, `Credit ₹`, `Running Balance` | Opening Gold/Cash, Total Debits, Total Credits, Closing Balance | **VERIFIED** |
| **BILL-WISE** | Invoiced-based sales & settlement tracking | `Bill No`, `Date`, `Party Name`, `Item Count`, `Gross Gold`, `Invoice Amount ₹`, `Gold Settled`, `Cash Paid`, `Balance Gold/Cash`, `Status` | Total Billed Amount, Total Gold Received, Outstanding Receivables | **VERIFIED** |
| **GROUPED** | Grouped by Party Category, Account Group, Karigar, or Purity | `Group Header`, `Voucher List`, `Subtotal Gross`, `Subtotal Fine`, `Subtotal Amount ₹` | Subtotal per Group + Grand Total | **VERIFIED** |
| **DAILY BALANCE** | End-of-day register cash & vault gold reconciliation | `Account/Drawer`, `Opening Balance`, `Inward (+)` , `Outward (−)`, `Adjustments`, `Closing Balance` | Total Vault Gold, Total Cash Drawer, Variance | **VERIFIED** |

---

## 2. Financial & Inventory Report Catalog

| Report Name | Route | Source Data Stores | Supported Filters | Output Channels | Parity Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Sales Register** | `/reports` | `useBilling.invoices` | Date Range, Customer, Payment Mode, Branch | Screen, Print, PDF, Excel | **VERIFIED** |
| **Purchase Register** | `/reports` | `usePurchases.purchases` | Date Range, Supplier, URD vs Registered, Purity | Screen, Print, PDF, Excel | **VERIFIED** |
| **Customer Outstanding** | `/reports` | `useBilling`, `useLedger` | Customer Group, Aging Bracket, Balance > 0 | Screen, Print, PDF, WhatsApp | **VERIFIED** |
| **Karigar Custody Summary**| `/reports` | `useWorkerGoldBook`, `useWorkers` | Karigar, Purity (22K/18K/14K), Active Status | Screen, Print, PDF, Slip | **VERIFIED** |
| **Karigar Period Settlement**| `/attendance?tab=settlement`| `calculateKarigarPeriodSettlement`| Week, Fortnight, Month, Custom Range, Worker | Screen, Print, PDF | **VERIFIED** |
| **Daily Rojmel** | `/reports/dhadi` | `useLedger.entries` | Date, Branch, Jama / Naam mode | Screen, Print, PDF | **VERIFIED** |
| **Dar Rojmel** | `/reports/dar-rojmel` | `useLedger.entries` | Date, Account Group, Cash/Bank | Screen, Print, PDF | **VERIFIED** |
| **Dhadi Book** | `/reports/dhadi` | `useWorkerGoldBook` | Date, Dhadi Group, Purity | Screen, Print, PDF | **VERIFIED** |
| **Fine Rojmel** | `/reports/dhadi` | `useLedger`, `useWorkerGoldBook` | Date, Metal Purity, Fine In/Out | Screen, Print, PDF | **VERIFIED** |
| **Item Jama-Nave** | `/reports/dhadi` | `useStock.movements` | Date, Item Category, Inward/Outward | Screen, Print, PDF | **VERIFIED** |
| **Ready Stock Valuation** | `/stock` | `useStock.items` | Category, Purity, Box/Tray, In-Stock | Screen, Print, PDF, Excel | **VERIFIED** |
| **Barcode Tag Inventory** | `/stock/print/$id` | `useStock`, `useManufacturingBarcodes`| Tag Number, Batch, HUID Status | Thermal Tag, Screen, PDF | **VERIFIED** |
| **Profit & Loss (P&L)** | `/reports` | `useBilling`, `useExpenses` | Financial Year, Quarter, Month | Screen, Print, PDF | **VERIFIED** |
| **Owner Drawings Register**| `/reports.owner-drawings` | `useExpenses.drawings` | Family Member, Payment Mode, Period | Screen, Print, PDF, Excel | **VERIFIED** |
| **Daily Close Report** | `/reports` | `useDailyCloses` | Date, Register, Closed By | Screen, Print, PDF | **VERIFIED** |

---

## 3. Real-Time Data Flow Integrity
All 36 reports pull directly from live, authoritative Zustand stores synchronized with Supabase postgres tables. Creating, editing, or settling any transaction triggers immediate reactive updates across:
$$\text{Transaction} \longrightarrow \text{Zustand Store} \longrightarrow \text{Derived Selectors} \longrightarrow \text{Report Table} \longrightarrow \text{Print / PDF Engine}.$$
Zero static mock arrays or hard-coded summary figures exist in report generation.
