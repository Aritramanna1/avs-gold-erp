# QA HANDOFF — Ornexa V1 Open QA

**Date:** 2026-08-16  
**QA start:** External/open-source QA team  
**Staging URL:** `https://avs-erp-preview-20260806.hostingersite.com`  
**Production:** **OUT OF SCOPE**

---

## Candidate status

**READY_FOR_QA** at code level. Tomorrow's QA should find **edge-case product defects**, not missing backends or unwired buttons.

---

## Before you start

1. Load `qa/config/qa.env` (auto-generated after successful `deploy-staging.mjs`, or use `qa/config/staging.env.example`)  
2. Confirm `QA_ALLOW_PRODUCTION_TARGET=0`  
3. Use **QA tenants only** — do not touch unknown business data  
4. Request PO for: Razorpay test keys, SMTP/WhatsApp vault credentials, Google OAuth if testing social login  

---

## Priority test matrix

### P0 — Must pass

| # | Flow | Steps | Pass criteria |
|---|------|-------|---------------|
| 1 | Public site | Visit `/`, `/pricing`, `/contact` | Loads, no console errors, trial CTA works |
| 2 | Trial signup | `/trial/start` | Tenant provisioned or clear error |
| 3 | Login routing | Email login as platform / tenant / portal | Lands correct workspace, not wrong portal |
| 4 | Route guard | Customer opens `/platform` | 404/denied, no data leak |
| 5 | Gold chain | Issue → receive → vault balance | Ledger matches UI |
| 6 | Tenant isolation | Tenant A vs B same screen | No cross-tenant rows |
| 7 | R2 upload | Ready stock photo | Preview + persists after reload |
| 8 | Print | Invoice PDF | Real logo; stamp only if configured |

### P1 — Should pass

| # | Flow | Notes |
|---|------|-------|
| 9 | Razorpay test checkout | Needs PO test keys |
| 10 | Email send | Needs SMTP in vault |
| 11 | WhatsApp send | Needs WABA/BSP config |
| 12 | Customization | Change rule → visible behavior change |
| 13 | Workspace switch | Multi-role user, no stale data |
| 14 | Google OAuth | Needs Supabase + Google console staging URLs |
| 15 | Financial reports | TB/P&L from real postings |

### P2 — Nice to have

| # | Item |
|---|------|
| 16 | MR/BN UI string coverage |
| 17 | Mobile shell navigation |
| 18 | Guided tour 4-step overlay |
| 19 | Downloads page (flag off = 404) |

---

## Automated suites (run locally against staging)

```bash
npm run typecheck
npm run build
npm run qa:unit
npm run qa:localization
npm run qa:database:rls
npm run security:scan
# With qa.env loaded:
npm run qa:e2e:smoke
npm run qa:accessibility
```

---

## Known external blockers (not product bugs)

| Item | Owner action |
|------|--------------|
| Hostinger upload 401 | Valid `HOSTINGER_API_TOKEN` |
| Google OAuth redirect | Google Cloud + Supabase dashboard |
| Razorpay live test payment | Test keys + webhook URL |
| Meta WABA embedded signup | Meta app + PO account |

---

## Defect reporting

Use `qa/reports-output/defects/DEFECTS.json` format:
- `PRODUCT_DEFECT` vs `TEST_DEFECT` vs `EXTERNAL_BLOCKER`
- Include ERR-* reference from UI when present
- Severity P0–P3

---

## Reference documents

| Doc | Purpose |
|-----|---------|
| [FINAL_IMPLEMENTATION_REPORT.md](./FINAL_IMPLEMENTATION_REPORT.md) | What's built |
| [FINAL_WIRING_VERIFICATION.md](./FINAL_WIRING_VERIFICATION.md) | Route/service matrix |
| [FINAL_SECURITY_VERIFICATION.md](./FINAL_SECURITY_VERIFICATION.md) | RLS/RBAC |
| [FINAL_CALCULATION_AUDIT.md](./FINAL_CALCULATION_AUDIT.md) | Gold/accounting |
| [FINAL_CUSTOMIZATION_VERIFICATION.md](./FINAL_CUSTOMIZATION_VERIFICATION.md) | Config consumption |
| [FINAL_LOCALIZATION_REPORT.md](./FINAL_LOCALIZATION_REPORT.md) | i18n |
| [FINAL_PERFORMANCE_REPORT.md](./FINAL_PERFORMANCE_REPORT.md) | Loading/errors |
| [FINAL_STAGING_DEPLOYMENT_REPORT.md](./FINAL_STAGING_DEPLOYMENT_REPORT.md) | Deploy state |
| [FINAL_PRE_QA_WIRING_MATRIX.md](./FINAL_PRE_QA_WIRING_MATRIX.md) | Master wiring audit |

---

## Exit criteria for QA sign-off

- All P0 flows pass on **staging URL** (not localhost only)  
- No `SECURITY_FAILURE` or data leak found  
- PO approves Razorpay/OAuth/comm smoke where configured  
- Defects triaged → fix branch → redeploy staging → retest  

**Production deploy requires explicit Product Owner approval after QA.**
