# Owner Acceptance Build — 2026-08-30

**Deployment target:** https://aurum.arivahly.in/  
**Supabase project:** `dqgrrafuoxaorvyrcuuh`  
**Verdict:** **DEPLOYED — ACCEPTANCE PARTIAL** (live static deploy verified; full authenticated workflow QA requires owner browser session)

---

## Build identity

| Field | Value |
|-------|--------|
| Surface | `aurum` (unified marketing + ERP on one origin) |
| Output dir | `dist-aurum/` |
| JS bundle | `index-DUtCwdzm.js` |
| CSS bundle | `index-DvzMl2Ot.css` |
| Build command | `npm run build:aurum` |
| Git SHA | N/A — workspace is not a git repository |
| Deploy method | Hostinger MCP `hosting_deployStaticWebsite` |
| Deploy archives | `dist-aurum_20260830_163334.zip`, `dist-aurum_20260830_163549.zip` (meta fix) |
| Deploy domains | `aurum.arivahly.in`, `erp.aurum.arivahly.in` (alias — replaces old CVsE73i6 shop bundle) |

---

## Architecture (final)

| Layer | Host | Notes |
|-------|------|-------|
| **Unified public + ERP** | https://aurum.arivahly.in | Marketing, Request Access, Sign In, full ERP after auth |
| **ERP alias** | https://erp.aurum.arivahly.in | Same unified build (no separate old shop bundle) |
| **Portals** | https://aurumportal.arivahly.in | Unchanged — portal surface (`dist-portal`) not redeployed this session |
| **Backend** | Supabase `dqgrrafuoxaorvyrcuuh` | Auth site_url → `https://aurum.arivahly.in` |

**Removed as primary deploy target:** `dist-marketing`-only split (obsolete for aurum.arivahly.in; unified `dist-aurum` replaces it).

---

## Pre-deploy QA (deterministic — no Playwright)

| Check | Result |
|-------|--------|
| `npm run typecheck` | **PASS** |
| `npm run qa:unit` | **131/131 PASS** |
| `npm run validate:migrations` | **PASS** (200 files; legacy duplicate-version warnings non-blocking) |
| `npm run qa:database:rls` | **PASS** (2/2) |
| `npm run test:service` | **PASS** (assistant + day1 selfchecks + report print audit) |
| `npm run security:scan` | **PASS** |
| `node scripts/verify-signup-policy-closure.mjs` | **10/10 PASS** |
| `npm run build:aurum` | **PASS** |

---

## Signup policy (production)

| Rule | Status |
|------|--------|
| NO public signup | **ENFORCED** — Auth `/signup` → 422 |
| NO public 14-day trial | **ENFORCED** — RPC revoked, edge 403, `/trial/start` → `/request-access` |
| NO arbitrary Google/tenant creation | **ENFORCED** — `enable_signup = false` |
| Invitation-only account creation | **ACTIVE** — `invite-accept` edge + rate limits |
| Existing user login | **VERIFIED** (E2E creds probe in signup script) |

---

## Live deployment verification

| Check | Result |
|-------|--------|
| SSL HTTPS | **PASS** — HTTP/1.1 200, Hostinger CDN |
| Homepage loads unified bundle | **PASS** — `/assets/index-DUtCwdzm.js` |
| SPA routes (`/login`, `/billing`) | **PASS** — same bundle served |
| Meta description (no trial CTA) | **PASS** after redeploy — "invitation-only access" |
| Supabase Auth `site_url` | **UPDATED** → `https://aurum.arivahly.in` |
| `erp.aurum.arivahly.in` old shop bundle | **REPLACED** — redeployed unified build |

---

## Egress / production safety

| Control | Status |
|---------|--------|
| Request throttling (`supabase-fetch-throttle`) | **ACTIVE** in client |
| Rate limits on hot RPCs | **APPLIED** (migrations through `20260830210000`) |
| Gold ledger pagination RPC | **ACTIVE** |
| Auth refresh quarantine in dev | **ACTIVE** (`dev-egress-guard`) |
| No load/stress tests run | **CONFIRMED** |

---

## Known blockers / owner follow-up

1. **Authenticated end-to-end workflows** — billing post→ledger→print, portal KYC, live Google OAuth button, mobile 5-tab — require owner browser login; not automated (Playwright excluded per instruction).
2. **`aurumportal.arivahly.in`** — portal surface not redeployed this session; verify separately if portal users are active.
3. **Obsolete Hostinger sites** — `avs-corporate-test.hostingersite.com`, `avs-erp-preview-20260806.hostingersite.com` remain on account; decommission manually after confirming no traffic.
4. **`dist-marketing/` artifact** — deprecated for production; do not deploy to aurum.arivahly.in (use `dist-aurum/` only).
5. **Overall A–Z parity register** — still **NOT PASS** for every module chain; this acceptance covers deployment + deterministic QA only.

---

## Tests not run (by instruction)

- Playwright E2E
- k6 load tests
- OWASP ZAP / Strix against production

---

*Generated at deployment acceptance — 2026-08-30 UTC+5:30*
