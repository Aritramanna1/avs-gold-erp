# ORNEXA RELEASE READINESS

**Version:** 2026-08-16  
**Status:** `READY_FOR_MANUAL_TEST`  
**NOT:** `VERIFIED` / production sign-off

---

## Decision

All approved P0 engineering for Razorpay, trial provisioning, communications deployment, billing adapter, and performance hardening is **implemented at code level**. Product Owner manual QA on staging is the next gate.

**Do not deploy to production Hostinger.** Staging/test deploy only until PO approves.

---

## Completed this pass

| Deliverable | Status |
|---|---|
| `platform-payment-api` + `razorpay-webhook` deployed | READY_FOR_MANUAL_TEST |
| Post-payment email + optional WhatsApp queue | READY_FOR_MANUAL_TEST |
| AMC renewal sweep (`sweep_amc_renewals`) | READY_FOR_MANUAL_TEST |
| Refund RPC + PO UI | READY_FOR_MANUAL_TEST |
| Billing print unified on `platform_invoices` | READY_FOR_MANUAL_TEST |
| Public trial tables + `provision_public_trial` | READY_FOR_MANUAL_TEST |
| Trial/CRM lead tasks | READY_FOR_MANUAL_TEST |
| WhatsApp campaign + inbox reply edges deployed | READY_FOR_MANUAL_TEST |
| `communication-scheduler` AMC/trial/outbox processing | READY_FOR_MANUAL_TEST |
| Migration reconciliation doc | READY_FOR_MANUAL_TEST |
| Production `dist/` build | READY_FOR_MANUAL_TEST |

---

## PO-only blockers

1. Razorpay test Key ID, Secret, Webhook Secret → Platform UI (never in git)
2. Razorpay Dashboard webhook URL → `https://<project>.supabase.co/functions/v1/razorpay-webhook`
3. Hostinger **staging** upload of new `dist/` (if no automated pipeline)
4. `PENDING_PRODUCT_OWNER_TOOL_NAME` — unnamed tool (does not block V1)
5. Playwright E2E authorization (deferred)

---

## Register

- [CODE_LEVEL_VERIFICATION_REGISTER.md](./CODE_LEVEL_VERIFICATION_REGISTER.md)
- [MIGRATION_RECONCILIATION.md](./MIGRATION_RECONCILIATION.md)
- [HOSTINGER_PERFORMANCE.md](./HOSTINGER_PERFORMANCE.md)

---

## Workflow

```
READY_FOR_MANUAL_TEST → PO staging QA → defect fixes → E2E authorized → production deploy → V1 freeze
```
