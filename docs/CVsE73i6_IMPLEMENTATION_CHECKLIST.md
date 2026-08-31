# CVsE73i6 — FINAL Implementation Checklist

**Sole foundation:** `index-CVsE73i6.js` / workspace CVsE73i6 source  
**Rule:** Implement on this source only. No old ERP copy.

**Local truth:** `production-dist-shop/` (frozen shop artifact) · **Aurum builds:** `npm run build:aurum`  
**Deploy:** Owner-only. ERP public host = `erp.aurum.arivahly.in`. Never `maatarajewellers.shop`.

---

## Phase 0 — Foundation & governance

| # | Item | Status |
|---|------|--------|
| 0.1 | `docs/MASTER/` paths resolve | DONE |
| 0.2 | `AGENTS.md` shop-only lock documented | DONE |
| 0.3 | `.env.local` / shop Supabase for local dev | DONE |
| 0.4 | No wrong `dist/` rebuild committed as truth | DONE |

---

## Phase 1 — Domain architecture (Aurum)

| # | Item | Status |
|---|------|--------|
| 1.1 | `public-origin.ts` — canonical ERP `erp.aurum.arivahly.in` | DONE |
| 1.2–1.7 | Host guards, auth callback, storage-proxy CORS | DONE |
| 1.8 | `public-site-url.ts` → marketing origin | DONE |
| 1.9 | `/verify` + `/doc/*` marketing redirects | DONE |
| 1.10 | OAuth env templates (`.env.production.*.example`) | DONE |
| 1.11 | `upload-dist-multi.mjs` surface dist mapping | DONE |
| 1.12 | Triple-dist: `app-surface.ts`, `build-surfaces.mjs` | DONE |
| 1.13 | `link-hosts.ts` central URL builders | DONE |

---

## Phase 2 — Commercial editions (₹10k / ₹30k / ₹50k + MTG)

| # | Item | Status |
|---|------|--------|
| 2.1 | DB migration `20260828090000_avs_edition_ladder.sql` | DONE |
| 2.2 | Retire old manufacturing_starter ladder for new assigns | DONE |
| 2.3 | `saas-entitlements.ts` → AVS ladder | DONE |
| 2.4 | Platform `/platform/plans` locked ladder UI | DONE |
| 2.5 | `apply_plan_entitlements` + `item_masters` key sync | DONE (`20260828113000_*`) |
| 2.6 | RLS + backend enforcement | DONE (org_features + gate aliases) |

---

## Phase 3 — AVS fundamentals

| # | Item | Status |
|---|------|--------|
| 3.1 | `gold_ledger` = metal SoT | DONE (constitution; no shadow balances added) |
| 3.2 | ULE = money SoT | DONE (existing ledger paths) |
| 3.3 | Fine gold `round(gross × purity / 999)` | DONE (`gold.ts` engine) |
| 3.4 | Default purity 995 in settings | DONE |
| 3.5 | Manufacturing gold-first | DONE (existing vault-first flows) |
| 3.6 | Labour on net weight | DONE (workshop process settings) |

---

## Phase 4 — Master Item

| # | Item | Status |
|---|------|--------|
| 4.1 | DB `item_masters` schema | DONE |
| 4.2 | `/catalog/masters` + CRUD UI | DONE |
| 4.3 | Entitlement gate `item_masters` | DONE (`feature-gate` aliases) |
| 4.4 | Wire to stock/orders/billing pickers | DONE (orders, stock entry, estimates, invoice Mfg rows) |

---

## Phase 5 — MTG shell

| # | Item | Status |
|---|------|--------|
| 5.1 | `/mtg` simplified nav shell | DONE |
| 5.2 | Module links (stock, orders, billing, workshop, etc.) | DONE |
| 5.3 | Gold + cash shown separately | DONE |
| 5.4 | Manubook toggle (default OFF) | DONE (Settings → Workshop + MTG nav) |
| 5.5 | Hide full ERP chrome on `/mtg` | DONE |

---

## Phase 6 — Platform Owner & config

| # | Item | Status |
|---|------|--------|
| 6.1 | Platform trials, billing hub | DONE (existing platform routes) |
| 6.2 | Config bundle import + export | DONE |
| 6.3 | `public/config-bundles/full-erp.json` | DONE |
| 6.4 | Estimate download PDF | DONE (`/billing/estimate/$id` PrintEngine + PDF) |
| 6.5 | Public verify rate limits migration | DONE |

---

## Phase 7 — Print / PDF / QR

| # | Item | Status |
|---|------|--------|
| 7.1 | PrintEngine vs legacy slips | DONE |
| 7.2 | QR → marketing `/verify` URLs | DONE |
| 7.3 | Google OAuth Aurum callbacks documented | DONE |

### Print audit

| Doc type | Engine | Status |
|----------|--------|--------|
| Orders print routes | PrintEngine | PASS |
| Workshop material slip | PrintEngine | PASS |
| Billing *-print routes | PrintEngine | PASS |
| `workshop.receive-slip` | PrintEngine | PASS |
| `workshop.filings-slip` | PrintEngine | PASS |
| `billing.settlement-slip` | PrintEngine | PASS |
| `conversion.slip` | PrintEngine | PASS |
| `estimate_doc` | PrintEngine + PDF download | PASS |

---

## Phase 8 — QA & release

| # | Item | Status |
|---|------|--------|
| 8.1 | Migrations applied on `dqgrrafuoxaorvyrcuuh` | DONE (3 migrations this phase) |
| 8.2 | `npx tsc --noEmit` | PASS |
| 8.3 | Playwright smoke | DONE (`e2e/tests/mobile-tablet-smoke.spec.ts`) |
| 8.4 | RLS / security QA | DONE (`npm run qa:database:rls`) |
| 8.5 | Mobile / tablet | DONE (touch targets + smoke spec) |
| 8.6 | `npm run build:aurum` local | PASS |
| 8.7 | Deploy to Aurum (owner approval only) | READY — `node scripts/upload-dist-multi.mjs erp.aurum.arivahly.in` etc. |

---

## Deploy command reference (owner runs when ready)

```bash
npm run build:aurum
node scripts/upload-dist-multi.mjs aurum.arivahly.in
node scripts/upload-dist-multi.mjs erp.aurum.arivahly.in
node scripts/upload-dist-multi.mjs aurumportal.arivahly.in
```

Never deploy `maatarajewellers.shop`.
