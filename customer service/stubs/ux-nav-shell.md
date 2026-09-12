# P0-2: AVS-4 Operator Primary Navigation Shell (MVP-NAV)

## Goal
Establish a clear, low-literacy-friendly primary chrome consisting of 8 simple, familiar action words: **Home · Sell · Customers · Stock · Make · Money · Reports · More**. Replace enterprise jargon (e.g. "Retail Operations", "Manufacturing WIP", "Treasury & Finance") with high-contrast, touch-accessible pill targets (≥48px height) that adapt smoothly across mobile, tablet, and desktop.

## Current tip evidence (paths)
- Navigation Definition: [`src/lib/firm-primary-nav.ts`](file:///c:/final%20erp%2029.08/new%20and%20final/src/lib/firm-primary-nav.ts)
  - Defines the 8 canonical slots: `Home` (`/app`), `Sell` (`/billing`), `Customers` (`/people?tab=customers`), `Stock` (`/stock`), `Make` (`/workshop`), `Money` (`/ledger`), `Reports` (`/reports`), and `More` (`/settings`).
- Contextual Header Component: [`src/components/layout/WorkspaceHeader.tsx`](file:///c:/final%20erp%2029.08/new%20and%20final/src/components/layout/WorkspaceHeader.tsx)
  - Renders the primary navigation pill row followed by active Layer-3 contextual workspace sub-tabs.
- App Shell Integration: [`src/components/app-shell.tsx`](file:///c:/final%20erp%2029.08/new%20and%20final/src/components/app-shell.tsx#L479)
  - `<WorkspaceHeader />` mounts right below the persistent header on all firm-scoped routes (`isFirmPrimaryPath`).
- Unit Verification: [`qa/unit/firm-scoped-boot.test.ts`](file:///c:/final%20erp%2029.08/new%20and%20final/qa/unit/firm-scoped-boot.test.ts)

## Changes (files / migrations / Hostinger)
1. **Source Code**:
   - `src/lib/firm-primary-nav.ts`: Authoritative array of 8 slots with icons and route-matching predicates.
   - `src/components/layout/WorkspaceHeader.tsx`: Touch-friendly styling (`min-h-12 text-xs font-semibold rounded-full border`), responsive horizontal scroll with hidden scrollbars, and active state highlights.
   - `src/components/app-shell.tsx`: Header responsiveness, profile picture alignment, and layout integration.
2. **Hostinger / Production**:
   - Deployed live on `https://erp.arivahly.in`.

## Acceptance
- Top navigation displays the exact sequence: Home · Sell · Customers · Stock · Make · Money · Reports · More.
- Clicking any slot navigates directly to the designated core module.
- On mobile/tablet screens, the nav bar scrolls smoothly horizontally without clipping or wrapping awkwardly.
- Zero reliance on legacy enterprise titles in the primary bar.

## Out of scope
- Renaming low-level database schemas or internal backend API endpoints.
- Re-architecting secondary modal dialogues.

## Status: Done
