# CODE-LEVEL VERIFICATION REGISTER

**Date:** 2026-08-16  
**Overall status:** `READY_FOR_MANUAL_TEST`  
**NOT claimed:** `MANUALLY_APPROVED` / `VERIFIED` / production sign-off

Method: static code + schema review + remote edge deploy + `npm run typecheck` + `npm run build`. No Playwright E2E (PO-deferred).

---

## Legend

| Status | Meaning |
|---|---|
| READY_FOR_MANUAL_TEST | Implemented; PO manual QA required |
| PARTIAL | Scaffold exists; live proof pending |
| BROKEN | Known code-level defect |
| BLOCKED | External credential/account only |

---

## 1. Razorpay Platform Billing

| Area | Status | Evidence |
|---|---|---|
| Schema (invoices, payments, receipts, fulfillments) | READY_FOR_MANUAL_TEST | Remote migrations + `20260816010000_*` |
| `platform-payment-api` edge | READY_FOR_MANUAL_TEST | Deployed remote v1 |
| `razorpay-webhook` edge | READY_FOR_MANUAL_TEST | Deployed; post-payment email queue wired |
| Checkout UI | READY_FOR_MANUAL_TEST | `RazorpayCheckout.tsx`, `LicensePurchasePanel`, `CreditsTab` |
| Payment links (PO hub) | READY_FOR_MANUAL_TEST | `PlatformCommercialBillingHub` |
| Refunds (PO record) | READY_FOR_MANUAL_TEST | `record_platform_refund` RPC + hub UI |
| AMC renewal scheduler | READY_FOR_MANUAL_TEST | `sweep_amc_renewals` + `communication-scheduler` |
| Razorpay credentials | BLOCKED | PO must configure via Platform UI |
| Live payment E2E | BLOCKED | Requires credentials + dashboard webhook |

## 2. Billing unification

| Area | Status | Evidence |
|---|---|---|
| Canonical source `platform_invoices` | READY_FOR_MANUAL_TEST | Commercial engine + adapter |
| Legacy `platform_billing_documents` | PARTIAL | Read-only historic; print route uses adapter fallback |
| GST print route | READY_FOR_MANUAL_TEST | `platform-invoice-adapter.ts`, `platform.billing-print.$id.tsx` |

## 3. Public trial + CRM

| Area | Status | Evidence |
|---|---|---|
| `provision_public_trial` RPC | READY_FOR_MANUAL_TEST | Applied remote |
| `public-trial-provision` edge | READY_FOR_MANUAL_TEST | Deployed remote |
| `trial-lifecycle-sweep` edge | READY_FOR_MANUAL_TEST | Deployed remote |
| Commercial leads table | READY_FOR_MANUAL_TEST | `platform_commercial_leads` |
| Lead tasks | READY_FOR_MANUAL_TEST | `platform_lead_tasks` |
| `/trial/start` UI | PARTIAL | Exists; PO OAuth redirect QA |

## 4. Communications

| Area | Status | Evidence |
|---|---|---|
| `send-email` edge | READY_FOR_MANUAL_TEST | Active remote |
| Email outbox + scheduler | READY_FOR_MANUAL_TEST | `email_outbox`, updated `communication-scheduler` |
| WhatsApp campaigns | READY_FOR_MANUAL_TEST | `run-whatsapp-campaign` deployed |
| Inbox replies | READY_FOR_MANUAL_TEST | `send-whatsapp-inbox-reply` deployed |
| Full template library (15–20) | PARTIAL | Schema + editor; not all events seeded |
| Scheduled report email | PARTIAL | `scheduled_report_deliveries` + scheduler; PO config QA |

## 5. Performance / session

| Area | Status | Evidence |
|---|---|---|
| Persistent auth | READY_FOR_MANUAL_TEST | `auth-storage.ts`, remember-me |
| Instant shell / prefetch | READY_FOR_MANUAL_TEST | `app-shell.tsx`, `route-prefetch.ts` |
| PWA / Hostinger cache headers | READY_FOR_MANUAL_TEST | `sw.js`, `.htaccess` (deploy artifact pending) |

## 6. Training / Help

| Area | Status | Evidence |
|---|---|---|
| Training Centre `/help` | PARTIAL | Curriculum exists; role filter enforcement incomplete |
| Guided tour | PARTIAL | 4-step overlay; full role paths pending |
| Help Agent | PARTIAL | `HelpAgentWorkspace` scaffold |

## 7. Core ERP (Orders → Billing chain)

| Area | Status | Evidence |
|---|---|---|
| End-to-end workflows | PARTIAL | Stores/routes exist; PO live-data QA |
| Customization designers | PARTIAL | UI exists; not all wired to runtime |
| Gold inventory / conversion RPC | PARTIAL | Migration `gold_lineage_*`; PO QA |
| Reports / accounting | PARTIAL | Routes + RPCs; derivation audit pending |
| Portals isolation | PARTIAL | Guards exist; live RLS audit pending |

## 8. Source control / deploy

| Area | Status | Evidence |
|---|---|---|
| Checkpoint commit | READY_FOR_MANUAL_TEST | This session |
| Hostinger staging deploy | BLOCKED | Build ready; upload requires PO/staging access |
| Playwright E2E | BLOCKED | PO authorization deferred |

---

## PO manual QA checklist (priority order)

1. Configure Razorpay test keys + webhook URL in dashboard
2. Plan purchase: Settings → Licence → pay test invoice → verify credits/subscription
3. Credit top-up via Razorpay
4. Cash collection propose + confirm (approved location)
5. Public trial signup `/trial/start` → tenant provisioned → lead in Platform Trials
6. Payment receipt email arrives (check `email_outbox` + inbox)
7. Persistent login + fast shell on staging Hostinger build
8. Portal isolation spot-check (customer/karigar IDs)
