# P0-4: Rate Chip & "Set Today's Gold Rate" One-CTA (AVS-4 / MVP-RATE-CTA)

## Goal
Eliminate lost showroom sales and incorrect valuation by providing prominent, unmissable rate-setting calls-to-action whenever the live gold rate is unconfigured. The operator must see a high-visibility rate chip in the global header and an alert banner on the home dashboard with a single tap to "Set Gold Rate Now".

## Current tip evidence (paths)
- Persistent Header Rate Chip: [`src/components/app-shell.tsx`](file:///c:/final%20erp%2029.08/new%20and%20final/src/components/app-shell.tsx#L282-L306)
  - `id="header-gold-rate-trigger"`: When rate is unset (`goldRatePerGramPaise === 0`), turns red (`border-red-500 bg-red-500/10 text-red-600 animate-pulse`) with text `"Rs. NOT SET"`. Clicking triggers `setGoldRateOpen(true)`.
- Home Dashboard Alert Banner: [`src/routes/app.tsx`](file:///c:/final%20erp%2029.08/new%20and%20final/src/routes/app.tsx#L457-L481)
  - When `goldRatePerGramPaise === 0`, renders prominent warning card with single button: `"Set Gold Rate Now"`.
- Rate Editor Modal: [`src/components/rate/GoldRateEditor.tsx`](file:///c:/final%20erp%2029.08/new%20and%20final/src/components/rate/GoldRateEditor.tsx)
  - Opens directly on trigger, allowing operators to update 24K, 22K (916), 18K (750), and silver rates with 1 click.
- Unit Test Lock: [`qa/unit/mtj-calculations.test.ts`](file:///c:/final%20erp%2029.08/new%20and%20final/qa/unit/mtj-calculations.test.ts)

## Changes (files / migrations / Hostinger)
1. **Source Code**:
   - `src/components/app-shell.tsx`: Rate chip in header with pulse state when rate is zero or missing.
   - `src/routes/app.tsx`: Home dashboard banner with event dispatch `open-gold-rate-editor`.
   - `src/lib/bullion-rate-service.ts`: Authoritative store and RPC listener for daily bhav.
2. **Hostinger / Production**:
   - Active on `https://erp.arivahly.in`.

## Acceptance
- If gold rate is 0: Header displays red pulsing `"Rs. NOT SET"` chip, and Home dashboard displays `"Gold Rate Not Set"` banner.
- Clicking either button instantly opens the Gold Rate Editor dialog.
- Setting a rate immediately updates the chip to `"Rs. XX,XXX/g"` with a green indicator, dismissing the alert banner without requiring a manual page refresh.

## Out of scope
- Scraping third-party websites for unauthorized gold rates without operator confirmation.
- Automatic rate extrapolation beyond standard purity ratios.

## Status: Done
