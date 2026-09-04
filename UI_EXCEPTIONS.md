# MTJ / AVS ERP — UI EXCEPTION REGISTER

This document is the **Official Exception Register** under the governance of [`UI_RULES.md`](./UI_RULES.md).  
Every permitted departure from standard application styling is documented below with its engineering rationale, scope, and approval status.

---

## 1. Exception Matrix

| ID | Component / Area | Source File | Current Behavior | Rationale | Approval Status | Planned Correction / Policy |
| :--- | :--- | :--- | :--- | :--- | :---: | :--- |
| **EXC-01** | Physical Print Engine Canvas | [`src/components/print/PrintPreviewModal.tsx`](./src/components/print/PrintPreviewModal.tsx), [`src/lib/print-document.ts`](./src/lib/print-document.ts) | Document preview iframe renders pure black-on-white (`#000000` on `#ffffff`) while outer modal frame uses Obsidian chrome (`#18181b`). | Thermal (80mm) and A4/A5 physical printers require zero ink waste and high optical contrast; printing dark app backgrounds would deplete thermal heads and cartridge toner. | **APPROVED (PERMANENT)** | None required. Governed by UI_RULES.md Section 24 (Print/Document Preview). |
| **EXC-02** | High-Density Barcode & QR Code Canvases | [`src/components/print/PrintQR.tsx`](./src/components/print/PrintQR.tsx), [`src/lib/barcode-svg.ts`](./src/lib/barcode-svg.ts) | Optical QR code blocks and 1D Code-128 barcodes render with strict `#000000` bars on `#ffffff` canvas blocks. | Hardware laser and camera barcode scanners require minimum 85% contrast ratio to decode SKU and HUID identifiers accurately. | **APPROVED (PERMANENT)** | None required. Governed by UI_RULES.md Section 19. |
| **EXC-03** | Standalone Electron Host Shell Control Center | [`electron-app/control-center.html`](./electron-app/control-center.html) | Self-contained static HTML file using embedded Tailwind-compatible CSS variables. | Must render instantaneously as a desktop host control center when Vite dev server, Supabase, and PostgreSQL are fully stopped. | **APPROVED (PERMANENT)** | Tokens must remain synchronized with `src/styles/tokens.css` via `npm run check:ui`. |
| **EXC-04** | Native Mobile WebView Splash Shell | [`src/components/layout/AuthNativeShell.tsx`](./src/components/layout/AuthNativeShell.tsx) | Uses `#14110f` background color token on the native container wrapper before React DOM hydration. | Prevents high-luminance white flicker during cold start in Capacitor mobile containers on Android/iOS. | **APPROVED (PERMANENT)** | None required. Matches the approved gold/dark brand identity. |
| **EXC-05** | Signed Balance Negative (Credit) Visual Indicator | [`src/lib/item-calculator.ts`](./src/lib/item-calculator.ts), [`src/components/ledger/LedgerTable.tsx`](./src/components/ledger/LedgerTable.tsx) | Displays un-clamped negative gold balances (e.g. `-11.350 g (Cr)`) in high-contrast red (`#ef4444`). | Required by jewellery accounting invariants (Scenario 1) to distinguish customer credit liabilities from shop assets without zero-clamping. | **APPROVED (PERMANENT)** | None required. Governed by UI_RULES.md Section 19 (Numeric Display). |

---

## 2. Governance Policy on Future Exceptions

1. **Zero Undocumented Exceptions:** Any developer or AI attempting to merge a component with custom styling, foreign icon sets, or hardcoded hex literals not listed in this register will have their PR rejected by `npm run check:ui`.
2. **Review Gate:** New entries to `UI_EXCEPTIONS.md` require explicit owner approval and must demonstrate an unavoidable hardware, optical, or protocol requirement.
