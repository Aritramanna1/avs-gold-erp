# FINAL SECURITY VERIFICATION — Ornexa V1

**Date:** 2026-08-16  
**Staging target:** `https://avs-erp-preview-20260806.hostingersite.com`

---

## Automated checks

| Check | Result |
|-------|--------|
| `npm run security:scan` (no service-role in client) | **PASS** |
| `qa/database/rls-isolation.test.ts` | **PASS** |
| Migration `20260816080000` client secret hardening | **Applied on remote** |
| `provider_secret_is_configured` RPC (no secret read in browser) | **PASS** |

---

## Layer matrix

| Layer | Mechanism | Status |
|-------|-----------|--------|
| Route guard | `guardRoute`, `auth-gate`, `route-access.ts` | **READY_FOR_QA** |
| Workspace isolation | `authorization-context-service` + store refresh on switch | **READY_FOR_QA** |
| Platform Owner isolation | `is_saas_admin()`, platform paths blocked for tenants | **READY_FOR_QA** |
| Portal party binding | portal RPCs + RLS policies | **READY_FOR_QA** |
| Tenant RLS | firm_id on all operational tables | **READY_FOR_QA** |
| Branch scope | branch_id policies + CEO filters | **READY_FOR_QA** |
| Storage R2 | tenant-scoped paths, signed proxy | **READY_FOR_QA** |
| RPC authorization | SECURITY DEFINER with internal checks | **READY_FOR_QA** |
| Payment webhook | signature verification + idempotency | **READY_FOR_QA** code |
| Session | Supabase Auth + session lock overlay | **READY_FOR_QA** |
| OAuth | Supabase provider (not removed) | **EXTERNAL_CONFIGURATION_REQUIRED** |
| Invitation tokens | `invite-accept` edge + expiry | **READY_FOR_QA** |

---

## Unauthorized route behavior

| Attempt | Expected | Verified |
|---------|----------|----------|
| Customer → `/platform` | 404 / access denied, no platform queries | Code path **READY_FOR_QA** — manual QA tomorrow |
| Tenant A → Tenant B data | RLS deny | Unit test **PASS** |
| Anon → ERP routes | Redirect `/login` | **READY_FOR_QA** |
| Logged-in → `/` | Public marketing (not ERP redirect) | **READY_FOR_QA** |

---

## Secrets policy

- No Razorpay secret, SMTP password, or Meta token in `src/` or `dist/`
- Platform secrets via `save-provider-secret` edge + vault tables
- Redaction in `client-secret-redaction.ts`

---

## QA focus (manual)

1. Two-tenant isolation spot-check (Tenant A / Tenant B)
2. Portal user cannot access ERP admin routes
3. Platform Owner cannot land in customer portal without explicit switch
4. Razorpay webhook rejects bad signature (test mode)
