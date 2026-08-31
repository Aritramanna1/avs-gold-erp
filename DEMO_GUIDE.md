# AVS Gold ERP — Demo RC1 Walkthrough Guide

A suggested path for presenting this build to the client, built around the flow already verified stable in this release.

## Before you start

1. Launch the app, sign in with a demo account.
2. Set today's gold rate (Home → "Set Gold Rate Now" banner, or Settings). Until this is set, money values and salary calculations intentionally show blank/zero — mention this is expected first-run behavior, not a bug.

## Suggested flow (~10-15 minutes)

1. **Home / Dashboard** — point out live order tracking (deliveries today, pending job cards, ready-for-billing), vault gold balance, and today's snapshot.
2. **Customer (People & KYC)** — add a customer with Aadhaar/KYC fields; show it's a unified registry for customers, firms, karigars, employees, and vendors.
3. **Order** — create an order for that customer directly from their profile ("Create Order"). Fill product type, description, target weight and purity.
4. **Job Card (automatic)** — on save, point out the Job Card is generated automatically and a karigar is assigned — no separate creation step. Show the Job Card preview/PDF.
5. **Workshop** — show the order's status moving through production stages.
6. **Worker Gold Book** — show the independent gold ledger tracking what's issued to and returned by karigars.
7. **Inventory (Stock)** — show finished stock, barcode/HUID tracking, and search/filter.
8. **Billing** — open an existing invoice or create one; show GST calculation, payment modes, and print/download.
9. **Reports** — show the operational/financial report hub (daily close, gold reconciliation, outstanding, etc.) pulling from live data.
10. **Settings** — briefly show firm profile, branches, users & roles, and security center.
11. **Logout** — clean sign-out back to the login screen.

## If something looks incomplete

- **Print for a document type without a redesigned layout yet**: explain the Print Engine migration is in progress (5 of ~15 document types on the new template system); the rest print through the previous, fully functional system. Nothing is broken — see `KNOWN_ISSUES.md`.
- **"Gold Rate Not Set" banner**: set the rate live in front of the client — it takes seconds and shows the system's flexibility.

## What NOT to do live

- Don't run bulk imports or destructive actions (delete/factory reset) against demo data unless intentionally showing that feature with a disposable dataset.
- Don't promise timelines on `todo.md`/backlog items (GST returns, e-invoicing, offline mode, etc.) — those are post-demo roadmap, not this build's scope.
