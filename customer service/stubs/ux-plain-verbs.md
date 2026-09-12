# P2-1: Plain Action Verbs for Low-Literacy Operators (MVP-VERBS)

## Goal
Replace complex enterprise jargon and technical descriptions across secondary screens and dialogs with **plain, familiar shop verbs**. Enable counter staff, bench artisans, and shop owners with varying levels of literacy and digital experience to navigate and execute tasks effortlessly without ambiguity:
- **"Look at piece"** (replacing "Catalog Master Inspection / Item Detail")
- **"AI help"** (replacing "Generative Neural Assistant / Automated Intelligence Engine")
- **"How we price gold"** (replacing "Multi-tier Bullion Algorithm & Differential Markups")
- **"Give metal"** (replacing "Workshop Raw Material Custody Issue")
- **"Who owes"** (replacing "Accounts Receivable Aging Matrix")

## Current tip evidence (paths)
- **Terminology Registry**: [`src/lib/workspace-registry.ts`](file:///c:/final%20erp%2029.08/new%20and%20final/src/lib/workspace-registry.ts)
  - Maps low-level system modules to plain operator titles.
- **Terminology Customizer**: [`src/routes/control.terminology.tsx`](file:///c:/final%20erp%2029.08/new%20and%20final/src/routes/control.terminology.tsx)
  - Allows shops to tailor shop labels to regional vernacular (Hindi, Bengali, Gujarati, English).
- **Workspace Gateways**: [`src/components/dashboard/WorkspaceGateways.tsx`](file:///c:/final%20erp%2029.08/new%20and%20final/src/components/dashboard/WorkspaceGateways.tsx)
  - Demonstrates plain verb hierarchy: Sell, Customers, Stock, Make, Money, Reports, More.

## Changes (files / migrations / Hostinger)
1. **Source Code**:
   - `src/components/catalog/`: Standardize inspection actions to "Look at piece".
   - `src/components/ai/`: Simplify generative button prompts to "AI help".
   - `src/components/rates/`: Header tooltips and rate breakdown modals labeled as "How we price gold".
   - Localization dictionaries (`src/locales/`): Align regional translations with everyday jewellery trade terminology rather than formal corporate phrasing.
2. **Hostinger / Production**:
   - Deployed bundle reflects updated language strings across all client routes.

## Acceptance
- Operators see actionable, intuitive phrases on buttons, cards, and modal dialogs.
- No unintelligible technical jargon appears on core counter or workshop touchpoints.
- Multilingual toggle preserves the plain-verb simplicity across Hindi, Bengali, Gujarati, and English.

## Out of scope
- Renaming backend database columns, SQL migration identifiers, or RPC function signatures.

## Status: In progress (Core gateways standardized; secondary modal sweeps active)
