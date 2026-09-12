# P1-2: Operator Attention Bell & Needs Attention View (MVP-ATTN)

## Goal
Implement an unmissable header **Attention Bell** with a badge counter that opens a focused, **read-only "Needs Attention"** panel. Aggregate high-priority operational exceptions across 4 critical jewellery business categories:
1. **RATE**: Missing or zero gold rate for today (blocking billing and valuation).
2. **IRN / GST**: E-invoicing failures, missing HUID/HSN, or unsubmitted B2B tax invoices.
3. **KARIGAR**: Overdue job cards, overdue metal custody, or artisan scrap weight discrepancies.
4. **EXCEPTION**: Unreconciled cash/vault variances, offline queue sync errors, or delayed customer orders.

The view must be strictly **VIEW-ONLY** and diagnostic: clicking an issue opens the corresponding action screen, but never executes automatic mutations to gold balances, accounting ledgers, or GST records.

## Current tip evidence (paths)
- **Header Bell**: [`src/components/notification-bell.tsx`](file:///c:/final%20erp%2029.08/new%20and%20final/src/components/notification-bell.tsx)
  - Renders unread badge count and links to notification center.
- **Notifications Hub**: [`src/routes/notifications.tsx`](file:///c:/final%20erp%2029.08/new%20and%20final/src/routes/notifications.tsx)
- **Notification State & Aggregation**:
  - Store: [`src/lib/notifications-store.ts`](file:///c:/final%20erp%2029.08/new%20and%20final/src/lib/notifications-store.ts)
  - Event definitions: [`src/lib/notifications/erp-events.ts`](file:///c:/final%20erp%2029.08/new%20and%20final/src/lib/notifications/erp-events.ts)
- **Rate Alert Invariant**: [`src/components/dashboard/RateWarningBanner.tsx`](file:///c:/final%20erp%2029.08/new%20and%20final/src/components/dashboard/RateWarningBanner.tsx)

## Changes (files / migrations / Hostinger)
1. **Source Code**:
   - `src/components/notification-bell.tsx`: Prioritize high-severity operational tags (`RATE`, `IRN`, `KARIGAR`, `EXCEPTION`) over routine information notices.
   - `src/routes/notifications.tsx`: Group incoming items into tabs or sections matching the 4 critical categories.
   - Operator Navigation: Provide single-click "Go fix" buttons directing operators to `/control/rates`, `/billing`, `/workshop`, or `/treasury/cash-book`.
2. **Hostinger / Production**:
   - Verify badge polling and idle-callback refresh perform cleanly on low-bandwidth connections without UI stutter.

## Acceptance
- If today's gold rate is missing, the Attention Bell badge activates immediately with a red indicator.
- Overdue Karigar jobs past their scheduled delivery date appear under the `KARIGAR` attention filter.
- Clicking any exception item navigates the operator directly to the relevant record.
- Zero automated financial or metal balance modifications occur without human operator action.

## Out of scope
- Automated background reconciliation of ledger or metal discrepancies.
- Modifying GST filings or IRN generation without explicit staff review.

## Status: In progress (Bell component active; categorization filters mapped)
