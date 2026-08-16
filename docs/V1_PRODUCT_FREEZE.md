# V1 PRODUCT FREEZE — Ornexa / AVS Gold ERP

**Effective:** 2026-08-15 (code-level verification complete)  
**Status:** `V1_SCOPE_FROZEN` — **NOT** final production sign-off  
**Next gate:** `READY_FOR_FRONTEND_QA` → Product Owner manual QA → bug-fix patches only

---

## Frozen scope

Everything approved by the Product Owner through the `/goal` sequence ending with:

> FINAL ORNEXA IMPLEMENTATION VERIFICATION + PUBLIC 14-DAY TRIAL + TRAINING + PRODUCT FREEZE + PRODUCTION READINESS

This includes (non-exhaustive):

- Supabase-online manufacturing ERP core (orders, workshop, gold, stock, billing, ledger)
- Universal Print / Export engines
- AVS Communication Platform (Email, WhatsApp module, campaigns, Meta control)
- Party 360 + CRM pipeline
- Portals (Customer, Karigar, Supplier) with tenant isolation
- Platform Owner control plane (trials, pricing, credits, Meta, Razorpay schema)
- Public 14-day trial signup funnel (`/trial/start`)
- Training Centre (`/help`) + guided tour offer + persisted progress
- AI Assistant with tool registry (credit-gated)
- Commercial pricing engine (effective-dated fees, plan versions)

---

## Allowed after freeze (without PO approval)

| Category | Examples |
|---|---|
| Bug fixes | Crashes, wrong calculations, RLS leaks |
| Security fixes | Auth, secrets, tenant isolation |
| Compliance | GST, Meta WhatsApp policy, consent |
| Performance | Bundle size, pagination, indexes |
| Accessibility | Keyboard, contrast, ARIA |
| Production blockers | Webhook, OAuth redirect, env config |
| Data integrity | Migration fixes, reversal flows |
| QA findings | Defects from Product Owner / QA testers |

---

## NOT allowed after freeze (requires explicit Product Owner approval)

- New major modules
- New business scope or workflows
- Experimental features
- Random UI redesigns
- Architecture rewrites
- Unrequested integrations

---

## Release train after freeze

1. **Production hardening** — env, secrets, webhooks, monitoring  
2. **Frontend QA** — Product Owner + testers on every screen/portal/print  
3. **Patch releases** — freeze-safe bug fixes only  
4. **Minor releases** — PO-approved enhancements  
5. **Major releases** — new scope via formal roadmap  

---

## Product principle (permanent)

> **Ornexa manages the business relationship around WhatsApp, not merely a “Send WhatsApp” button.**

Party 360 + CRM + Inbox + Orders + Gold + Invoices + Documents + Support in one place, on the shared **AVS Communication Platform** (`product_id` on every record).

---

## Pending item (do not guess)

See `docs/PENDING_PRODUCT_OWNER_TOOL_NAME.md` — additional tool name not yet supplied by Product Owner.
