# Ornexa / AVS A-To-Z Master

This is the full product control checklist for Ornexa / AVS Jewellery Manufacturing ERP. It is a scope authority, not a claim that every row is complete in code.

Status values:

- COMPLETE: verified end-to-end in UI, backend, database, audit, documents, and tests.
- PARTIAL: useful implementation exists but needs hardening or missing linked workflows.
- IMPLEMENTING: actively being wired in current work.
- MISSING: not yet implemented.
- NEEDS AUDIT: code/data exists but security, RLS, posting, or workflow correctness is not yet verified.

## A. Authority And Product Memory

| Area | Status | Acceptance |
|---|---|---|
| Product constitution | COMPLETE | `ORNEXA_PRODUCT_CONSTITUTION.md` exists and is referenced from `AGENTS.md`. |
| Master product specification | COMPLETE | Foundation, commercial, material, manufacturing, inventory, finance, intelligence, and outputs are documented. |
| Decision log | COMPLETE | Product decisions are recorded with reason and impact. |
| Changelog | COMPLETE | Master-document and implementation changes are recorded. |
| Implementation matrix | COMPLETE | Scope, status, evidence, blockers, and acceptance gaps are tracked. |

## B. SaaS Foundation

| Area | Status | Acceptance |
|---|---|---|
| Platform owner console | IMPLEMENTING | Owner can manage firms, users, subscriptions, licensing, service requests, support, billing, health, audit, backups, and settings. |
| Tenant isolation | NEEDS AUDIT | Every tenant-scoped table has correct RLS and branch/user boundaries. |
| Branch/location model | PARTIAL | Branch selector, branch settings, and stock/workflow filters work without white-on-white or hidden-state regressions. |
| Plans and subscriptions | PARTIAL | Plans can be created, assigned, renewed, expired, and audited from owner console. |
| Module licensing | PARTIAL | License issue/renew/suspend and module entitlement states are visible and auditable. |
| Platform billing | PARTIAL | Software invoice/quotation/proforma creation and print preview work from owner console. |
| Support operations | PARTIAL | Tenant/staff/customer tickets and live thread exist; owner queue and error-context creation need final verification. |

## C. Identity, Roles, And Security

| Area | Status | Acceptance |
|---|---|---|
| Supabase Auth | PARTIAL | Sessions persist across browser windows; sign-out and switch account still clear sensitive stores. |
| Role model | PARTIAL | Platform owner, tenant owner, branch manager, accountant, sales, manufacturing, inventory, karigar, and customer personas are represented. |
| Permissions | NEEDS AUDIT | Roles are permissions, not navigation presets; server-side enforcement must match UI. |
| Session policy | IMPLEMENTING | Non-critical checks must not block app shell startup. |
| Error handling | IMPLEMENTING | Error screens expose reference ID, technical summary, create ticket, live chat, copy details, and support contact. |
| Audit | PARTIAL | Critical business and platform actions write auditable records. |

## D. Canonical Masters

| Area | Status | Acceptance |
|---|---|---|
| Party master | PARTIAL | One party can hold customer, supplier, karigar, dealer, employee, carrier, billing, and branch profiles. |
| Product/design master | PARTIAL | Designs, categories, variants, images, tags, barcodes, HUID, stones, diamonds, boxes, trays, and locations are maintained. |
| Metal and purity master | PARTIAL | Gold, silver, alloy, purity/touch, fine conversion, and rates are configurable. |
| Dropdown/config masters | PARTIAL | Small values are admin-configurable without code changes. |

## E. Universal Transaction Engine

| Area | Status | Acceptance |
|---|---|---|
| Transaction contract registry | IMPLEMENTING | `src/lib/ornexa/transaction-contracts.ts` defines statuses, dimensions, posting rules, documents, approvals, reversals, and portal visibility. |
| Draft/validate/calculate/check/approve/post/document/notify lifecycle | PARTIAL | Existing modules follow pieces of the lifecycle; universal enforcement is pending. |
| Immutable posting and reversal | PARTIAL | Ledger reversal exists; all posted document types must use reversal or compensating entries. |
| Configurable workflows | PARTIAL | Workflow engine exists, defaults to manufacturing-only, hydrates/persists through Supabase app settings, and now uses explicit `combined_commerce_manufacturing` wording instead of ambiguous Hybrid wording for mixed business operations. Must still connect fully to transaction contracts, audit every setting change, and browser-test all role workflows. |

## F. Commercial Workflows

| Area | Status | Acceptance |
|---|---|---|
| Customer order-to-cash | PARTIAL | Order, job card, manufacturing bill, delivery, invoice, payment, reminder, and close are linked. |
| Estimates and quotations | PARTIAL | Estimate creation, print, conversion, and audit verified. |
| Sales invoice | PARTIAL | GST, cash/metal payments, print, reversal, and ledger posting verified. |
| Returns and credit/debit notes | PARTIAL | Documents exist; postings and reports need final audit. |
| Purchase/inward | PARTIAL | Supplier purchase and inventory inward lifecycle need full verification. |
| Old gold intake | PARTIAL | Appraisal, melting, purity conversion, deduction, customer settlement, and refinery flow need completion. |
| Payment allocation | PARTIAL | Cash, bank, UPI, card, gold paid, credit note, and outstanding allocation need universal handling. |

## G. Manufacturing Core

| Area | Status | Acceptance |
|---|---|---|
| Job card | PARTIAL | Job card generation, assignment, print, and status changes are linked to order/manufacturing. |
| Manufacturing issue | PARTIAL | Gold/material custody moves to worker/department/external party with fine-gold accountability. |
| Manufacturing receive | PARTIAL | Finished, semi-finished, scrap, dust, rejected, loss, and rework receipts are posted and auditable. |
| Karigar gold book | PARTIAL | Worker custody, return, wastage, loss, labour, advance, settlement, and hisab are complete. |
| Process templates | PARTIAL | KDM, Meena, stone setting, polish, cutting, casting, melting, hallmark, and configurable next process need graph controls. |
| QC and approval | PARTIAL | Approvals exist; QC checklist, rework, rejection, and final release need configurable enforcement. |
| Hallmark/HUID | PARTIAL | Hallmark outward, return, HUID capture, rejection, rework, memo, and report need final lifecycle. |
| Finished stock tagging | PARTIAL | Barcode/QR/HUID/label/print and inventory availability need final verification. |

## H. Inventory And Movement

| Area | Status | Acceptance |
|---|---|---|
| Vault gold | PARTIAL | Opening, purchase, issue, receive, adjustment, reconciliation, and audit verified. |
| WIP and semi-finished | PARTIAL | Custody and process-stage inventory visible by party, branch, process, and order. |
| Finished stock | PARTIAL | Finished items, ready stock, valuation, ageing, barcode, and sale status verified. |
| Scrap/dust/recovery | PARTIAL | Scrap/dust/recovery accounts, melting, conversion, and loss reports verified. |
| Stones/diamonds/components | PARTIAL | Parcel, issue, consumption, balance, loss, and valuation workflows verified. |
| Branch/warehouse transfer | PARTIAL | Source issue, in-transit, destination receive, discrepancy, and print controls verified. |
| Physical stock audit | PARTIAL | Count, variance, approval, adjustment, report, and lock controls verified. |

## I. Finance, Ledger, And Close

| Area | Status | Acceptance |
|---|---|---|
| Dual cash/metal ledger | PARTIAL | Cash, bank, gold, fine gold, stones, pieces, labour, GST, and custody are separate dimensions. |
| Customer ledger | PARTIAL | Gold, cash, invoices, old gold, advances, outstanding, and statements verified. |
| Supplier ledger | PARTIAL | Purchase, payment, return, GST, and outstanding verified. |
| Karigar ledger | PARTIAL | Gold custody, labour, deductions, advances, settlement, and statements verified. |
| Expenses and payroll | PARTIAL | Expenses, salary, attendance, advances, bonuses, and close reports verified. |
| Attendance bulk entry | PARTIAL | Bulk daily attendance supports multi-worker add/update for a selected date with defaults, validation, duplicate-safe upsert, review before save, and save state. Remaining: date-range batch mode, mobile/browser evidence, and central activity timeline audit evidence. |
| GST and tax | PARTIAL | CGST/SGST/IGST, ITC, e-invoice readiness, GST return reports, and state rules verified. |
| Day close | PARTIAL | Cash, gold, stock, pending docs, queues, and approvals checked before close. |
| Period/month close | PARTIAL | Locks prevent backdated posting except audited override. |
| Tally/export | PARTIAL | Export-ready ledger mappings and reconciliation reports verified. |

## J. Documents, Print, And Output

| Area | Status | Acceptance |
|---|---|---|
| Universal print engine | PARTIAL | Template selection, preview, print, PDF fallback, Supabase print job history, audit, and reprint controls verified. Invoice print, payment receipt, customer settlement slip, credit note print, debit note print, estimate print, delivery challan print, and gold settlement voucher direct links now fetch the requested document by ID from Supabase/RLS and seed only that document into print runtime state instead of depending on full register hydration. Remaining: authenticated printer workflow, real invoice/document print evidence, browser PDF evidence, and reprint controls. |
| Thermal/label/barcode print | PARTIAL | Barcode/QR/tag generation and fallback PDF verified across supported printers. |
| Business documents | PARTIAL | Estimate, order, job card, issue, receive, challan, invoice, receipt, settlement, hallmark, close reports verified. Credit note, debit note, estimate, and delivery challan detail/print direct links now load their specific records from Supabase/RLS before using existing Supabase-backed runtime actions, removing register-hydration dependency for these document workflows. |
| Document sharing | PARTIAL | Secure link, customer portal visibility, expiry, and audit verified. |
| Excel/PDF reports | PARTIAL | Reports export with filters, totals, signatures, and print-ready formatting. |

## K. Reports And Intelligence

| Area | Status | Acceptance |
|---|---|---|
| Owner dashboard | PARTIAL | Sales, orders, WIP, gold position, billing, overdue, approvals, and exceptions load progressively. CEO branch KPI cards use `supabase/migrations/20260813055000_ceo_branch_kpis_rpc.sql` and `src/lib/services/ceo-dashboard-service.ts` for RLS-respecting Supabase RPC summaries with bounded fallback instead of multi-table `readAll()` hydration. CEO gold trend, manufacturing gold summary, production status, and worker performance now use `src/lib/services/ceo-dashboard-analytics.ts` plus prepared migration `supabase/migrations/20260813055500_ceo_dashboard_gold_trend_rpc.sql` instead of compatibility stores. Remaining before PASS: apply the prepared RPC migration to the correct Supabase project, authenticated no-leak/timing evidence, mobile screenshots, and cross-check against owner-console KPIs. |
| Manufacturing reports | PARTIAL | WIP, worker balance, loss/wastage, process ageing, QC, hallmark, and job profitability verified. `/reports/manufacturing`, `/reports/gold-summary`, `/reports/gold-outstanding`, and `/reports/gold-position` now use bounded Supabase/RLS report reads with explicit loading/error/empty/capped states instead of compatibility-store filtering for these routes. Remaining before PASS: authenticated no-leak evidence, full-history aggregate/export paths, QC/hallmark/job-profitability route coverage, and mobile table verification. |
| Inventory reports | PARTIAL | Stock, valuation, ageing, movement, branch, variance, and material position verified. |
| Finance reports | PARTIAL | Day book, cash/bank, receivable, payable, GST, P&L, ledger statements verified. |
| Exception reports | PARTIAL | Missing rate, negative gold, overdue delivery, pending job card, failed print, failed comms, schema errors visible. |

## L. Portals And Communication

| Area | Status | Acceptance |
|---|---|---|
| Customer portal | PARTIAL | Orders, invoices, documents, support tickets, replies, and secure links verified. |
| Karigar portal | PARTIAL | Assigned work, issue/receive, balances, messages, and settlement visibility verified. |
| Staff support center | PARTIAL | Staff can create support tickets and chat live. |
| Owner support queue | PARTIAL | Platform owner can view, assign, respond, close, and audit tickets. |
| WhatsApp | PARTIAL | Deep link, provider API, templates, queue, retry, attachment, and audit verified. |
| Email | PARTIAL | Provider configuration, templates, attachments, retry, and audit verified. |
| Notifications | PARTIAL | App, reminder, due, approval, support, and exception notifications verified. |

## M. Performance And Loading

| Area | Status | Acceptance |
|---|---|---|
| Compatibility repository cap | PARTIAL | `src/lib/repositories/base-repository.ts` generic `readAll()` is capped at 1000 Supabase rows and documented as a transitional compatibility path only. High-volume routes still require dedicated Supabase query/RPC implementations with filters, counts, pagination, and authenticated timing evidence before PASS. |
| Receipt verification | PARTIAL | `/verify` supports QR payload and document-number verification. Number lookup now uses direct Supabase/RLS column and JSON-field queries for job cards, orders, invoices, repairs, and rate-cut slips instead of full repository scans. Remaining: authenticated valid/tampered/not-found evidence, mobile camera scan evidence, and indexed document-number verification on high-volume datasets. |
| Progressive startup | IMPLEMENTING | Shell appears first; content skeleton fills; heavy checks and services load after first paint. |
| In-app navigation without dead refresh | PARTIAL | Route outlets now use content-level skeleton fallbacks so the app shell remains mounted during route loading. Remaining: browser click verification across jewellery books/modules and mobile/desktop screenshots. |
| Route-level resilience | IMPLEMENTING | Bad records do not crash whole routes; errors show technical summary and support actions. |
| Supabase online resilience | PARTIAL | Supabase is authoritative. Browser-local database/file-vault infrastructure has been removed from active code; print jobs, scheduler, escalations, device registry, reconciliation, attachments, webhook history, backup requests, DR drills, key-rotation records, workflow settings, communication settings, automation settings, manufacturing bills, branch access state, backup scheduler config, weekly statement toggles, reference notes, and document numbering are Supabase-backed or runtime-only. Local pilot import/export restore is retired, the old local-to-cloud migration module is deleted, Daily Close no longer blocks printing on local migration, and architecture/database/release docs now identify Offline/Hybrid as superseded legacy guidance. Anonymous privileged RPC execution is revoked. Direct signed-in execution is also removed for internal trigger/maintenance, provisioning, platform settings, universal posting, onboarding, platform billing helpers, and raw license-validation RPCs. Remaining signed-in `SECURITY DEFINER` surface is 31 current product/RLS helper functions pending per-workflow least-privilege evidence. Remaining: authenticated workflow verification, full RLS/performance advisor cleanup, realtime/conflict evidence, leaked-password protection dashboard enablement, and performance warnings. |
| Large data strategy | PARTIAL | Ready Stock uses Supabase range/count pagination, query/status filters, URL state, loading/error/filtered-empty states, and page controls through `src/lib/stock-query.ts` and `src/routes/stock.index.tsx`. People main tabs now use `src/lib/people-query.ts` for Supabase range/count pagination, URL-backed search/tab/page state, per-tab counts, and bounded 250-row compatibility hydration in `data-loader`/`people-store` instead of startup loading thousands of parties. Orders register now uses `src/lib/orders-query.ts` for Supabase range/count pagination, URL-backed search/status/type/page state, and loading/error/filtered-empty states instead of filtering the compatibility cache in React. The Home cockpit now uses `src/lib/home-dashboard-query.ts` and prepared RPC `supabase/migrations/20260813060000_home_dashboard_summary_rpc.sql` instead of reading six tenant-wide compatibility stores for dashboard metrics. Manufacturing workspace landing now uses `src/lib/manufacturing-query.ts` for Supabase exact-count summary metrics and bounded recent manufacturing bill rows instead of full bill/job-card store refreshes. Manufacturing reports now use `src/lib/manufacturing-report-query.ts`, `src/lib/gold-summary-report-query.ts`, `src/routes/reports.manufacturing.tsx`, `src/routes/reports.gold-summary.tsx`, and `src/routes/reports.gold-outstanding.tsx` for Supabase/RLS bounded report rows, capped-preview warnings, and loading/error/empty states. Gold Position reports now use `src/lib/gold-position-report-query.ts` and `src/routes/reports.gold-position.tsx` for Supabase/RLS period+branch bounded `gold_ledger` slices, retryable errors, loading/empty states, and capped-preview warnings instead of filtering the in-memory ledger store. Billing invoice register now uses `src/lib/billing-query.ts` for Supabase range/count pagination, URL-backed search/page state, loading/error/empty states, and server-side invoice totals; Billing Outstanding now has `supabase/migrations/20260813054000_billing_outstanding_rpc.sql` and `fetchBillingOutstandingSummary()` with an RLS-respecting RPC plus bounded fallback. Billing customer ledger now uses `src/lib/customer-ledger-context.ts` to hydrate selected-customer Supabase context for invoices, orders, gold settlements, job cards, and delivery challans instead of requiring global tenant-wide cache hydration before rendering ledger state. Customer settlement reports now use `src/lib/delivery-summary-query.ts`, `src/routes/reports.delivery-summary.tsx`, `src/routes/reports.settlements.tsx`, and `src/routes/reports.settlement-reconciliation.tsx` for bounded Supabase/RLS reads with loading/error/capped states instead of broad customer-settlement/billing store hydration. Dealer and Worker reports now use `src/lib/party-report-query.ts`, `src/routes/reports.dealer.tsx`, and `src/routes/reports.worker.tsx` for bounded Supabase/RLS People, gold settlement, and worker transaction rollups instead of report-route hydration of People/Gold Book stores. Platform owner firm stats now use `src/lib/platform-stats-query.ts` with the `get_platform_firm_stats()` Supabase aggregate RPC migration and bounded count fallback instead of 10k invoice/order/job-card client reducers. `src/lib/orders-store.ts`, `src/lib/data-loader.ts`, `src/lib/billing-store.ts`, `src/lib/jobcards-store.ts`, `src/lib/stock-store.ts`, `src/lib/melt-store.ts`, `src/lib/ledger-store.ts`, `src/lib/worker-gold-book-store.ts`, and `src/lib/workers-store.ts` now use explicit 500/1000-row Supabase compatibility-cache limits instead of detected 5k/10k/20k hydrations. Remaining: route-level pagination for other Reports, richer indexed Orders search across customer/item text, manufacturing-bill inclusion in Billing customer ledger, Supabase aggregate/RPC-backed full historical balances for ledger/worker books, repairs, authenticated Daily Close full-history aggregate/RPC proof, indexed/RPC Delivery Summary high-volume evidence, authenticated high-volume timing, and remote RPC application evidence. |

## N. Final Completion Gate

The ERP is A-to-Z complete only when every P0 and P1 row in this master is COMPLETE or explicitly deferred by Product Owner decision, and each has:

1. UI workflow verified on desktop and mobile.
2. Backend/database behavior verified.
3. RLS/security verified.
4. Ledger/posting behavior verified where applicable.
5. Audit behavior verified.
6. Print/document behavior verified where applicable.
7. Report output verified where applicable.
8. Error/empty/loading states verified.
9. Regression test or documented manual acceptance evidence.


