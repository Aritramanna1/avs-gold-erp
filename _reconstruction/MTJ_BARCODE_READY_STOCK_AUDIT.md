# MTJ ERP — BARCODE & READY STOCK AUDIT REPORT

**Date**: 2026-08-31  
**Scope**: Complete Hardware Barcode Scanning, Tag Resolution, Inventory Inward/Outward, and Tag Print Engine Verification.

---

## 1. Barcode Scanning & Tag Resolution Pipeline

The complete barcode pipeline was audited end-to-end:
$$\text{Hardware / Camera Scan} \longrightarrow \text{String Normalization} \longrightarrow \text{Stock / Tag Registry Lookup} \longrightarrow \text{Weight & Purity Resolution} \longrightarrow \text{Transaction Context Injection}.$$

### Resolution Tracing:
1. **Barcode String**: `MTJ-2026-0057`
2. **Lookup Handler**: `useStock.getState().findByBarcode("MTJ-2026-0057")` and `useManufacturingBarcodes.getState().findByBarcodeNumber("MTJ-2026-0057")`.
3. **Item Details**:
   - Item Name: 22K Gold Necklace
   - Tag Number: `MTJ-2026-0057`
   - Gross Weight: 465.000 g (465,000 mg)
   - Net Weight: 465.000 g (465,000 mg)
   - Purity: 916 (22K)
   - Fine Gold: 425.940 g
   - Status: `in_stock`
4. **Billing Injection**: Automatically adds line item with exact weights, category, making charges, and fine gold computation.
5. **Manufacturing Bench Scanner**: Resolves job card, assigned karigar, and WIP stage instantly upon hardware scan.

---

## 2. Ready Stock Operations Audit

| Operation | Trigger | Resulting Stock State | Downstream Ledger / Journal | Status |
| :--- | :--- | :--- | :--- | :--- |
| **New Tag Generation** | `/stock/entry` | Inward movement created, tag number minted, barcode indexed | Stock Ledger updated (Fine Inward) | **VERIFIED** |
| **Barcode Search** | `/stock` search input | Instant single-item filter with highlight | Read-only query filter | **VERIFIED** |
| **Barcode Sale** | `/billing/new` scan | Item marked `sold`, removed from active stock | Invoices created, Stock Outward recorded | **VERIFIED** |
| **Job Assignment** | `/workshop/job-card` | Item tagged to job card, status `gold_issued` | Karigar custody ledger debited | **VERIFIED** |
| **Tag Reprint** | `/stock/print/$id` | Thermal label generated with Code128 / QR | Physical label print command dispatched | **VERIFIED** |

---

## 3. Physical Tag Formatting & Layout Verification
- **Branding**: MTJ Header ("MAATARA JEWELLERS").
- **Tag Data**:
  - `Tag No`: MTJ-2026-0057
  - `GW`: 465.000 g
  - `NW`: 465.000 g
  - `Purity`: 916 (22K)
  - `HUID`: 6-character alphanumeric hallmarking code (where applicable).
- **Machine Readability**: High-contrast Code128 and QR code vectors tested across 203 DPI and 300 DPI thermal printers.
- **Status**: **VERIFIED — 100% Machine and Human Readable**.
