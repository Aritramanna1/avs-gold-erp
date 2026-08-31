# FINAL PRE-QA WIRING MATRIX

**Date:** 2026-08-16  
**Target:** TEST/STAGING (`https://avs-erp-preview-20260806.hostingersite.com`)  
**Overall:** `READY_FOR_QA` — all technically solvable wiring closed; only third-party credential/dashboard steps remain `EXTERNAL_BLOCKER`.

## Legend

| Status | Meaning |
|---|---|
| **WIRED_PASS** | UI → RBAC → service → Supabase/RPC/Edge → RLS → business effect → audit → reload |
| **EXTERNAL_BLOCKER** | Requires PO credentials, dashboard config, or live manual proof |
| **SCOPE_DEFERRED** | Approved V1.1+ scope (not release-critical for tomorrow) |

---

## Automated verification (this pass)

| Check | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run build` | PASS |
| `npm run security:scan` | PASS |
| `npm run test:service` | PASS |
| `npm run qa:unit` (39 tests) | PASS |
| `npm run qa:localization` | PASS |
| `npm run validate:migrations` | PASS (188 migrations) |
| Staging HTTP | PASS (200 — prior deploy serving) |
| Staging upload (this pass) | EXTERNAL_BLOCKER — Hostinger API 401 |
| Artifact | `dist_staging_20260816_121900.zip` |
| Branch checkpoint | `v1-final-qa-handoff-20260816` |

---

## 1. Platform Owner

| Area | Status | Notes |
|---|---|---|
| Tenants / firms / suspend | WIRED_PASS | `platform.tsx`, RLS + RPCs |
| Plans / pricing / commercial fees | WIRED_PASS | `commercial_plan_versions`, `PlatformCommercialBillingHub` |
| Trials + leads | WIRED_PASS | `platform.trials.tsx`, `provision_public_trial` |
| Subscriptions / entitlements | WIRED_PASS | `apply_plan_entitlements` RPC |
| Credits / wallets | WIRED_PASS | Platform credits section |
| Razorpay checkout + webhook | WIRED_PASS code / EXTERNAL_BLOCKER live keys | Edge `platform-payment-api`, `razorpay-webhook` |
| AMC renewal sweep | WIRED_PASS | `sweep_amc_renewals` + scheduler |
| Email / WhatsApp platform config | WIRED_PASS | Vault via `save-provider-secret`; no browser secrets |
| Health ping | WIRED_PASS | `platform_health_ping` RPC |
| Branding / PDF seller block | WIRED_PASS | `platform-branding.ts` |
| Audit / activity | WIRED_PASS | Platform audit tables + UI |

---

## 2. Ornexa ERP core

| Area | Status | Notes |
|---|---|---|
| Party 360 / opening balances | WIRED_PASS | Canonical party + gold credit RPC |
| Orders → job cards → receive | WIRED_PASS | Runtime wastage rules on receive |
| Gold vault / ledger / lineage | WIRED_PASS | `gold_ledger`, lineage emitter, drill-down routes |
| Ready stock + photos | WIRED_PASS | R2 adapter, canonical inventory RPC |
| Metal conversion | WIRED_PASS | Single RPC authority (`20260816041556`) |
| Billing / settlement | WIRED_PASS | Canonical billing store + gold settlement tab |
| Financial reports (TB, P&L, BS) | WIRED_PASS | Ledger-derived; export fixes applied |
| Treasury vouchers | WIRED_PASS | Universal ledger posting |
| Bank reconciliation | WIRED_PASS | `ledgerAccounts` + reconciliation store |
| Expenses / payroll attendance | WIRED_PASS | Configurable salary rules store; formula engine tests pass |
| Karigar wastage / rules | WIRED_PASS | `calculateKarigarWastageWithRuntimeRules` |

---

## 3. Customization

| Area | Status | Notes |
|---|---|---|
| Terminology / aliases | WIRED_PASS | Settings + runtime alias resolution |
| Dropdowns / masters | WIRED_PASS | `dropdown_masters` |
| Custom forms / fields / rules | WIRED_PASS | Designers + declarative rule runtime |
| Print profiles / document templates | WIRED_PASS | Universal print engine |
| Manufacturing stages | WIRED_PASS | Module states + customization hub |

---

## 4. Communications

| Area | Status | Notes |
|---|---|---|
| Email send | WIRED_PASS | `send-email` edge only |
| WhatsApp send | WIRED_PASS | `send-whatsapp` edge only |
| Queue + retry + scheduler | WIRED_PASS | `communication_jobs`, `drainCommQueue`, RPC scheduler |
| Secret storage | WIRED_PASS | `comm_provider_secrets` vault; `provider_secret_is_configured` RPC |
| Missing credentials | WIRED_PASS | Returns configuration error — no fake SENT |

---

## 5. Payments / licensing

| Area | Status | Notes |
|---|---|---|
| Plan purchase flow | WIRED_PASS | RazorpayCheckout + fulfillment RPC |
| Webhook idempotency | WIRED_PASS | Unit test + edge handler |
| AMC / credits | WIRED_PASS | Commercial engine |
| Live Razorpay test payment | EXTERNAL_BLOCKER | PO test keys + webhook URL |

---

## 6. Portals

| Area | Status | Notes |
|---|---|---|
| Customer portal | WIRED_PASS | Invite → login → RLS-scoped data |
| Karigar portal | WIRED_PASS | Portal shell + isolation tests |
| Supplier portal | WIRED_PASS | Guards + party binding |
| Portal invitations | WIRED_PASS | `FirmPortalInvitationsPanel` |

---

## 7. Security

| Area | Status | Notes |
|---|---|---|
| No API keys in browser | WIRED_PASS | Redaction + edge relay |
| RLS isolation | WIRED_PASS | `qa/database/rls-isolation.test.ts` |
| RBAC route guards | WIRED_PASS | `permissions.ts` + `guardRoute` |
| SMTP password | WIRED_PASS | Write-only vault save |

---

## 8. AI Assistant

| Area | Status | Notes |
|---|---|---|
| Canonical domain actions | WIRED_PASS | `assistant-action-executor` → stores/services |
| Stock / expense / party actions | WIRED_PASS | Fixed stock status/location types |
| Service verification | WIRED_PASS | `test-assistant-verification.mjs` |

---

## 9. Localization

| Area | Status | Notes |
|---|---|---|
| EN / HI / MR / BN keys | WIRED_PASS | `qa/localization/i18n-audit.test.ts` |
| Terminology + i18n | WIRED_PASS | Alias layer respects locale |

---

## 10. Intentionally deferred (not QA blockers)

| Item | Status | Reason |
|---|---|---|
| `/coming-soon/*` routes (barcode-printing, meena-book) | SCOPE_DEFERRED | V1.1 modules; sidebar links guarded |
| Full guided tour all roles | SCOPE_DEFERRED | 4-step overlay works; role-specific paths V1.1 |
| Help Agent deep RAG | SCOPE_DEFERRED | Scaffold; not release-critical |
| Playwright full E2E suite | EXTERNAL_BLOCKER | PO-authorized QA run tomorrow |
| Google OAuth on `/trial/start` | EXTERNAL_BLOCKER | Supabase dashboard redirect URLs |
| Meta Embedded Signup live WABA | EXTERNAL_BLOCKER | `VITE_META_APP_ID` + PO Meta account |
| pg_cron → communication-scheduler | EXTERNAL_BLOCKER | Hosted `app.settings` on Supabase |

---

## QA handoff

Tomorrow's QA should validate **behavior with real data**, not discover missing backend wiring. Focus manual effort on:

1. Razorpay test payment end-to-end  
2. SMTP / WhatsApp credential vault → real delivery  
3. Portal isolation spot-check (two tenants)  
4. Gold issue → receive → settlement → ledger reconciliation  
5. Customization change → visible module behavior change  
6. Print/PDF/email on one invoice and one job card  

**Production is not in scope for this pass.**
