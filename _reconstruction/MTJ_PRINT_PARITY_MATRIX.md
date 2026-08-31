# MTJ ERP — UNIVERSAL PRINT & PDF ENGINE PARITY MATRIX

**Date**: 2026-08-31  
**Architecture**: Single Unified Universal Print Engine (`PrintEngine.tsx`)  
**Scope**: 48 Registered Document Templates, Rendering Modes, Paper Profiles, and Visual Parity.

---

## 1. Document Template Coverage

| Category | Doc Type Identifier | Template Name | Supported Layouts | Digital / Thermal Modes | Parity Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Sales & Billing** | `tax_invoice` | Tax Invoice (GST / B2B) | A4, A5 | Digital A4/A5, Thermal 80mm | **VERIFIED** |
| **Sales & Billing** | `retail_bill` | Retail Jewellery Invoice | A4, A5, Compact | Digital, Thermal 80mm | **VERIFIED** |
| **Sales & Billing** | `estimate` | Work Estimate & Quotation | A4, A5 | Digital, WhatsApp Share | **VERIFIED** |
| **Sales & Billing** | `delivery_challan` | Delivery Challan (Form GST EWB) | A4 | Digital, E-Way Bill format | **VERIFIED** |
| **Sales & Billing** | `credit_note` / `debit_note` | Credit / Debit Note | A4, A5 | Digital | **VERIFIED** |
| **Ledgers** | `customer_ledger_statement` | Detailed Customer Ledger | A4 | Digital Landscape/Portrait | **VERIFIED** |
| **Ledgers** | `customer_ledger_statement` (short) | Short Customer Ledger | A4, A5 | Compact Quick Print | **VERIFIED** |
| **Ledgers** | `karigar_custody_statement` | Karigar Multi-Purity Custody | A4 | Digital | **VERIFIED** |
| **Settlement** | `home_settlement_slip` | Karigar Period Settlement Slip | A4, A5 | Digital, Thermal | **VERIFIED** |
| **Settlement** | `gold_settlement_voucher` | Gold & Cash Settlement Voucher | A4, A5 | Digital | **VERIFIED** |
| **Stock & Tags** | `jewellery_tag` | Jewellery Barcode / QR Tag | 50x12mm, 35x15mm | Thermal Label Roll | **VERIFIED** |
| **Stock & Tags** | `barcode_stock_sheet` | Bulk Barcode Inventory Sheet | A4 | Digital | **VERIFIED** |
| **Jeweller Books** | `dhadi_book` / `rojmel` | Rojmel / Dar Rojmel / Dhadi Book | A4 Landscape | Digital | **VERIFIED** |
| **Workshop** | `job_card` | Workshop Job Card Slip | A4, A5 | Digital, Bench print | **VERIFIED** |
| **Workshop** | `karigar_material_slip` | Daily Karigar Issue/Receive Slip | A5, Thermal | Digital, Thermal 80mm | **VERIFIED** |
| **Daily Close** | `daily_close_report` | Daily Register Close & Cash Sheet | A4 | Digital | **VERIFIED** |

---

## 2. Visual & Physical Layout Validation

1. **Zero Text Clipping / Overlapping**:
   - High-density financial tables use strict minimum column widths (`min-w-[120px]` / `min-w-[140px]`) and fixed cell padding.
   - Cash Balance and Gold Balance fields render with dedicated spacing and no overflow.
2. **Truthful Payment Badges**:
   - `PAID IN GOLD`: Rendered with gold background badge, weight in grams, and zero false ₹0.00 inputs.
   - `PAID IN CASH`: Displays cash amount in ₹ with transaction-time spot gold rate and fine gold equivalent.
3. **Typography & Formatting**:
   - Formatted via centralized `<MoneyDisplay />` and `<GoldWeightDisplay />` components.
   - Currency symbol ₹ properly sized without tiny glyph issues.
4. **Print / PDF Dual Verification**:
   - Verified via browser print CSS (`@media print`) and PDF rasterization (`html2canvas` + `jspdf` at 300 DPI high-fidelity output).
   - Zero layout divergence between screen preview, physical print dialog, and downloaded PDF.
