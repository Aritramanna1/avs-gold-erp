# P0-5: Home Dashboard — Gold Today then Cash & Operator Shortcuts (MVP-HOME)

## Goal
Establish a clear, low-literacy-friendly Home dashboard (`/app`) where **Gold (g @ 995) is always presented first** and **Cash (₹) is presented second**, strictly kept in separate dimensions. Ensure the 5 most critical daily shop operations are directly accessible in ≤3 taps via large, touch-accessible cards and pills (≥48px height):
1. **Sell** (New sale / counter invoice)
2. **Old gold** (Customer gold purchase / receipt)
3. **Give metal** (Karigar metal issue / workshop gold book)
4. **Who owes** (Customer & Karigar balance ledger)
5. **Day done** (End-of-day register close & audit)

## Current tip evidence (paths)
- **Home Route (`/app`)**: [`src/routes/app.tsx`](file:///c:/final%20erp%2029.08/new%20and%20final/src/routes/app.tsx)
  - Lines 266–318: Gold-first KPI blocks (Vault Gold `summary.goldBuckets.vault` g, With Karigars `summary.goldBuckets.karigar` g, Today Billing in g Fine before Cash ₹).
- **Primary Gateways**: [`src/components/dashboard/WorkspaceGateways.tsx`](file:///c:/final%20erp%2029.08/new%20and%20final/src/components/dashboard/WorkspaceGateways.tsx)
  - Plain operator action cards: Sell (`/billing`), Customers (`/people`), Stock (`/stock`), Make (`/workshop`), Money (`/ledger`), Reports (`/reports`), More (`/settings`).
  - Direct shortcut links: "New sale" (`/billing/new`), "Who owes" (`/ledger`), "Give metal" (`/workshop/gold-book`), "Day done" (`/reports/daily-close`).
- **Mobile Home View**: [`src/components/dashboard/MobileHomeDashboard.tsx`](file:///c:/final%20erp%2029.08/new%20and%20final/src/components/dashboard/MobileHomeDashboard.tsx)
  - Touch-optimized responsive dashboard for counter staff using handheld tablets or mobile phones.
- **Rate Warning Banner**: [`src/components/dashboard/RateWarningBanner.tsx`](file:///c:/final%20erp%2029.08/new%20and%20final/src/components/dashboard/RateWarningBanner.tsx)
  - Prominent alert at the top of Home when gold rate is unconfigured or zero.

## Changes (files / migrations / Hostinger)
1. **Source Code**:
   - `src/routes/app.tsx`: Enforce Gold before Cash hierarchy across all role snapshots (Owner, Workshop, Billing). Ensure dual-unit balances never collapse into a single fiat value.
   - `src/components/dashboard/WorkspaceGateways.tsx`: High-contrast icon + plain verb cards with direct links to the 5 core operator actions.
   - `src/components/dashboard/MobileHomeDashboard.tsx`: Mobile operator quick-actions row with ≥48px touch targets.
2. **Hostinger / Production**:
   - Built bundle deployed to `https://erp.arivahly.in`.

## Acceptance
- Landing on `/app` displays Gold quantity (g @ 995) visually ahead of Rupee amounts.
- Operator can initiate a Sale, log Old Gold, Issue Metal to a Karigar, check Debtor Balances, or run Day Close in ≤2 clicks from Home.
- All primary interactive elements maintain a minimum 48px touch target area.
- Zero visual blending of gold grams and rupees (no synthetic single-currency valuation without distinct gram notation).

## Out of scope
- Merging gold grams and currency into a single blended portfolio metric (strictly forbidden by domain rules).
- Re-architecting back-office accounting journal logic.

## Status: Done
