# FINAL WIRING VERIFICATION — Ornexa V1

**Date:** 2026-08-16  
**Authoritative defect list:** [FINAL_PRE_QA_WIRING_MATRIX.md](./FINAL_PRE_QA_WIRING_MATRIX.md)

## Chain verified

```
UI → validation → RBAC → config → domain service → Supabase/RPC/Edge → RLS → business effect → audit → UI refresh
```

## Status matrix

| Area | Route / entry | Service / RPC | RLS | Status |
|------|---------------|---------------|-----|--------|
| Public homepage | `/` | `get_public_website_bundle` | anon RPC | **READY_FOR_QA** |
| Unified login | `/login` | Supabase Auth | — | **READY_FOR_QA** |
| Trial signup | `/trial/start` | `provision_public_trial` | SECURITY DEFINER | **READY_FOR_QA** |
| ERP dashboard | `/app` | `get_home_dashboard_summary` | tenant RLS | **READY_FOR_QA** |
| Platform Owner | `/platform/*` | platform RPCs | `is_saas_admin()` | **READY_FOR_QA** |
| Customer portal | `/customer-portal` | portal RPCs | party isolation | **READY_FOR_QA** |
| Supplier portal | `/supplier-portal` | portal RPCs | party isolation | **READY_FOR_QA** |
| Karigar portal | `/karigar-portal` | portal RPCs | party isolation | **READY_FOR_QA** |
| CEO workspace | `/dashboard/ceo` | CEO KPI RPCs | branch scope | **READY_FOR_QA** |
| Gold vault | `/stock`, vault panels | `gold_ledger`, lineage emitter | metal RLS | **READY_FOR_QA** |
| Ready stock + photos | `/stock` | inventory RPC + R2 | tenant RLS | **READY_FOR_QA** |
| Metal conversion | conversion routes | `post_metal_conversion_atomic` | single authority | **READY_FOR_QA** |
| Billing / settlement | `/billing`, settlement | billing-store + RPC | branch RLS | **READY_FOR_QA** |
| Financial reports | `/reports/financial-statements` | ledger-derived | tenant RLS | **READY_FOR_QA** |
| Customization | `/control/customization` | declarative-rules-runtime | tenant RLS | **READY_FOR_QA** |
| Print / PDF | print routes | universal print engine | tenant assets R2 | **READY_FOR_QA** |
| Email send | settings + comm centre | `send-email` edge | vault secrets | **READY_FOR_QA** |
| WhatsApp send | whatsapp workspace | `send-whatsapp` edge | vault + billing | **READY_FOR_QA** |
| Razorpay purchase | billing centre | `platform-payment-api`, webhook | idempotent RPC | **EXTERNAL_CONFIGURATION_REQUIRED** live keys |
| Google OAuth | `/login`, trial | Supabase Google provider | — | **EXTERNAL_CONFIGURATION_REQUIRED** |
| Website media upload | Platform Website Manager | R2 `firm-assets` | saas_admin write | **READY_FOR_QA** |
| Downloads centre | `/downloads` | `website.downloads` setting | flag-gated | **READY_FOR_QA** (disabled by default) |

## Remaining non-wiring items

| Item | Classification |
|------|----------------|
| Hostinger staging upload (401 token) | **EXTERNAL_CONFIGURATION_REQUIRED** |
| Razorpay test payment E2E | **EXTERNAL_CONFIGURATION_REQUIRED** |
| Google OAuth redirect URLs on staging | **EXTERNAL_CONFIGURATION_REQUIRED** |
| Meta WABA embedded signup | **EXTERNAL_CONFIGURATION_REQUIRED** |
| pg_cron → communication-scheduler | **EXTERNAL_CONFIGURATION_REQUIRED** (Supabase hosted) |

## No release-critical PARTIAL wiring

Per matrix audit: no open `FAIL`, `FRONTEND_ONLY`, `BACKEND_ONLY`, `CONFIG_NOT_CONSUMED`, `DUAL_PATH`, or `SECURITY_FAILURE` items remain for V1 scope.
