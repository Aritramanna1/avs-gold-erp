# P0-3: Stock Lands on Gold First (AVS-4 / MVP-STOCK)

## Goal
Enforce the fundamental domain rule of jewellery operations: **GOLD FIRST · CASH SECOND · ALWAYS SEPARATE**. When an operator clicks **Stock** in the primary navigation, the system must land directly on the **Gold Balance & Vault** panel (grams @ 995 fine gold) rather than generic ready stock items or barcode lists.

## Current tip evidence (paths)
- Route Definition: [`src/routes/stock.index.tsx`](file:///c:/final%20erp%2029.08/new%20and%20final/src/routes/stock.index.tsx)
  - `validateSearch`: defaults search parameter `tab` to `"gold"` (lines 35–38).
  - `StockRoute`: conditionally renders `<StockGoldPanel />` with `<StockHubTabs active="gold" />` by default when `tab === "gold"` (lines 371–383).
- Gold Stock Component: [`src/components/stock/StockGoldPanel.tsx`](file:///c:/final%20erp%2029.08/new%20and%20final/src/components/stock/StockGoldPanel.tsx)
  - Displays authoritative live gold balance (Gross weight, Purity, 995 Fine Gold equivalent, Vault reconciliation).
- Hub Navigation: [`src/components/stock/StockHubTabs.tsx`](file:///c:/final%20erp%2029.08/new%20and%20final/src/components/stock/StockHubTabs.tsx)
  - Contextual sub-tabs: Gold (`/stock?tab=gold`), Ready Stock (`/stock?tab=ready`), Items/Barcodes.

## Changes (files / migrations / Hostinger)
1. **Source Code**:
   - `src/routes/stock.index.tsx`: Updated route search schema to validate and default `tab` to `"gold"`.
   - `src/components/stock/StockGoldPanel.tsx`: High-contrast gold weight summary with direct action shortcuts (Transfer metal, Reconcile, Audit).
   - `src/lib/firm-primary-nav.ts`: Slot `stock` points to `/stock` which immediately mounts Gold first.
2. **Hostinger / Production**:
   - Deployed live on `https://erp.arivahly.in`.

## Acceptance
- Clicking "Stock" from any page in the ERP lands on `/stock` with the Gold Vault & Balance panel active.
- Gold quantity is visibly displayed in grams at 995 purity before any cash or finished goods counts.
- Ready stock / retail barcode view is accessible in one click via the `Ready Stock` sub-tab.

## Out of scope
- Removing ready stock or barcode search capabilities.
- Mixing finished goods pricing into pure bullion vault weights.

## Status: Done
