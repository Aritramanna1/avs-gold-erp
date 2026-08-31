# PARITY CLOSURE AUDIT — Frozen Shop vs Editable Dev

**Date:** 2026-08-30  
**Frozen build:** `production-dist-shop/` (`index-CVsE73i6.js`) via `http://localhost:3002`  
**Editable build:** `npm run dev` via `http://localhost:3000`  
**QA tenant:** `mtj.qa.firm-owner.20260731@example.com` / firm `f9f73cce-9538-4286-9754-530ca4581fbb`  
**Verdict:** **NOT PASS** — KPI parity achieved; route/workflow/migration gaps remain

---

## Method

1. Frozen preview on port **3002** (`vite preview --outDir production-dist-shop`).
2. Editable dev on port **3000** (`VITE_ENABLE_DEV_SUPABASE=1`).
3. Same QA login on both builds.
4. Live browser side-by-side (UI + behaviour + data), plus deterministic scripts:
   - `scripts/parity-frozen-vs-editable.mjs`
   - `scripts/verify-migrations-applied.mjs`
   - `scripts/verify-dashboard-live.mjs`
5. Route byte comparison vs shop extract `01-online-avs-ornexa`.

**No Playwright.** Frozen reference not modified.

---

## Side-by-side dashboard (live browser, same session data)

| Metric | Frozen (3002) | Editable (3000) | Match? |
|--------|---------------|-----------------|--------|
| Vault gold | 226824.182 g | 226824.182 g | ✅ |
| With karigars | 32116.567 g | 32116.567 g | ✅ |
| Open orders | 414 (416 total) | 414 (416 total) | ✅ |
| Finished stock | 21 items / 4402.387 g | 21 items / 4402.387 g | ✅ |
| Today billing | ₹0 | ₹0 | ✅ |
| Party gold held | -3836.894 g | -3836.894 g | ✅ |
| Delayed orders badge | **412** | **118** (pre-fix) → fix applied, **re-verify pending** | ❌ → fix in code |

### Delayed orders mismatch (root cause corrected)

| | |
|---|---|
| **FROZEN** | 412 delayed orders |
| **EDITABLE (before)** | 118 delayed orders |
| **DIFFERENCE** | Under-count by 294 |
| **ROOT CAUSE (layer 1)** | `HOME_ROW_LIMIT = 120` vs shop **500** — fixed earlier |
| **ROOT CAUSE (layer 2 — actual)** | `app.tsx` re-merged buckets from `orders-store` cache (120 rows, `updated_at` order) **after** correct `fetchOrderBucketsOnly` ran; also `fetchOrderBucketsOnly` returned empty when `resolveCurrentFirmId()` was null |
| **FIX** | (1) `orders-store.ts` hydrate limit **120 → 500**; (2) `fetchHomeDashboardSummary` now always calls `fetchOrderBucketsOnly` inside RPC path (matches shop extract); (3) removed store re-merge effect from `app.tsx`; (4) removed premature `firm_id` filter from `fetchOrderBucketsOnly` (RLS-scoped like shop) |
| **VERIFICATION** | REST probe `scripts/probe-delayed-orders.mjs` → **412 delayed / 414 open orders** on QA; live browser re-check on `:3000/app` after dev restart required |

---

## Order creation (`/orders/new`)

| | |
|---|---|
| **FROZEN** | Production bundle `orders.new-CwK3a4qV.js` — Less Wt, Add Wt, Wastage %, Labour/Majuri, Cash Advance, Gold Received |
| **EDITABLE** | All sections present in live browser snapshot (Customer, Production, Products, Gold Received, Workshop) |
| **DIFFERENCE** | None on field checklist |
| **ROOT CAUSE** | N/A (restored earlier in A–Z pass) |
| **VERIFICATION** | Browser snapshot 2026-08-30 on `:3000/orders/new` |

---

## Route divergence count

**Before session:** ~57 routes with byte ratio &lt; 0.85 or &gt; 1.15 vs shop extract  
**After batch restore:** **21** remaining (see list below)

### Batch restored this continuation (typecheck PASS)

| Route | Ratio before |
|-------|----------------|
| `invite.accept.tsx` | 0.63 |
| `karigar-portal.tsx` | 0.64 |
| `stock.transfers.tsx` | 0.67 |
| `treasury.vouchers.tsx` | 0.69 |
| `reports.financial-statements.tsx` | 0.70 |
| `settings.print-templates.tsx` | 0.72 |
| `billing.delivery-challans.$id.tsx` | 0.79 |
| `billing.estimates.index.tsx` | 0.82 |
| `reports.settlements.tsx` | 0.82 |
| `otp-login.tsx` | 0.81 |
| + `contact.tsx`, `tutorials.tsx`, `stock.print.$id.tsx` | |

Deps copied: `operational-books.ts`, `party-search-select.tsx`; `Person.partyCode`, `stock-transfer-store.loadError`, login search param fixes.

### Remaining diverged routes (21)

| Route | Ratio | Notes |
|-------|-------|-------|
| `trial.start.tsx` | 0.02 | **Intentional** — editable redirects to `/request-access` |
| `karigar-login.tsx`, `customer-login.tsx`, `supplier-login.tsx` | ~0.78 | Thin wrappers — verify side-by-side |
| `workshop.gold-book.tsx` | 0.83 | Large file — field audit needed |
| `ledger.tsx`, `billing.receipt.$id.tsx`, `saas-admin.tsx` | &gt;1.15 | Editable **larger** — may be enhancements; verify not blind restore |
| `reports.gold-ledger.tsx`, `treasury.bank-reconciliation.tsx` | &gt;1.15 | Editable additions — verify behaviour |
| Marketing routes (`index`, `features`, `faq`, etc.) | &gt;1.15 | Lower priority vs ERP ops |

---

## QA migrations status (corrected probes)

| Object | QA status | Notes |
|--------|-----------|-------|
| `get_home_dashboard_summary` | ✅ | Callable |
| `get_gold_ledger_page` | ✅ | Exists with `p_bucket, p_purity, …` signature (probe was wrong before) |
| `resolve_document_share` | ✅ | Anon-granted; authenticated probe was false-negative |
| `check_api_rate_limit` | ✅ exists | Internal (`p_bucket_key`); not PostgREST-exposed to anon |
| `item_groups` table | ❌ **NOT APPLIED** | `supabase db query --linked -f 20260830280000…` **BLOCKED** — `SUPABASE_DB_PASSWORD` missing / CLI auth failed |
| `provision_public_trial` blocked | ✅ | Returns 4xx as expected |

**BLOCKER:** Owner must supply DB password or apply `20260830280000_item_groups_and_inventory_master_link.sql` via approved channel. Portal/KYC/Item Groups verification remains blocked until applied.

---

| | |
|---|---|
| **FROZEN** | 20563 bytes (extract) |
| **EDITABLE (before)** | 9789 bytes (48%) |
| **DIFFERENCE** | Missing stock entry fields/workflow |
| **ROOT CAUSE** | Route stripped during partial rebuild |
| **FIX** | Restored from `01-online-avs-ornexa` extract |
| **VERIFICATION** | `npm run typecheck` PASS |

### billing.purchases.index.tsx — **RESTORE ATTEMPTED**

| | |
|---|---|
| **FROZEN** | Full purchase billing index (extract) |
| **EDITABLE (before)** | 55% of extract size |
| **FIX** | Copied from extract this session |
| **VERIFICATION** | typecheck + manual `/billing/purchases` |

### attendance.index.tsx — **RESTORE ATTEMPTED**

| | |
|---|---|
| **FROZEN** | Full attendance module |
| **EDITABLE (before)** | 81% of extract size |
| **FIX** | Copied from extract this session |
| **VERIFICATION** | typecheck + manual `/attendance` |

### settings.whatsapp.tsx — **RESTORE ATTEMPTED**

| | |
|---|---|
| **FROZEN** | Full WhatsApp settings surface |
| **EDITABLE (before)** | 71% of extract size |
| **FIX** | Copied from extract this session |
| **VERIFICATION** | typecheck + manual `/settings/whatsapp` |

### login / public entry

| | |
|---|---|
| **FROZEN** | "Start 14-Day Trial" CTAs (legacy bundle) |
| **EDITABLE** | "Request access" (invitation-only policy) |
| **DIFFERENCE** | Intentional product policy change in editable; frozen bundle unchanged |
| **ROOT CAUSE** | `docs/SIGNUP_RESTRICTION_IMPLEMENTATION.md` |
| **VERIFICATION** | `qa/unit/invitation-only-signup.test.ts` |

### Heading typography (cosmetic)

| | |
|---|---|
| **FROZEN** | `DAILY OPERATIONS`, `TODAY'S SNAPSHOT` (uppercase) |
| **EDITABLE** | `Daily operations`, `Today's Snapshot` |
| **DIFFERENCE** | CSS/title-case only — data identical |
| **FIX** | Optional CSS parity pass — low priority |

---

## A–Z surface status (honest)

| Surface | Data parity | UI/workflow parity | Verdict |
|---------|-------------|-------------------|---------|
| Auth / login gates | ✅ QA login works both | 🟡 policy CTAs differ | PARTIAL |
| Dashboard + snapshot | ✅ KPIs match | 🟡 delayed count fixed | PARTIAL→🟡 |
| Customers / karigars | ✅ 27 / 50+ (RPC) | 🟡 not all forms audited | PARTIAL |
| Stock / stock entry | ✅ counts | 🟡 entry restored, not browser-verified | PARTIAL |
| Orders / orders.new | ✅ | ✅ fields match | PARTIAL (create flow not posted) |
| Billing / settlement | 🟡 | 🟡 purchases restore pending verify | NOT PASS |
| Gold / vault / ledger | ✅ vault KPI | 🔴 `get_gold_ledger_page` RPC missing on QA | NOT PASS |
| Reports / print / PDF | 🟡 | 🟡 testids present; live PDF not audited | NOT PASS |
| KYC / portals | 🟡 | 🔴 portal upload chain open | NOT PASS |
| Customization / settings | 🟡 firm-scoped ids | 🟡 APPLY→PDF not fully verified | NOT PASS |
| Mobile | 🟡 | ⬜ not side-by-side audited | NOT PASS |
| Migrations (backend) | — | 🔴 several RPCs/tables not applied | **BLOCKED** |

---

## Migration apply status (QA Supabase — live probes)

| Migration / object | Local file | QA applied? | Evidence |
|--------------------|------------|-------------|----------|
| `get_home_dashboard_summary` | yes | ✅ | RPC 200 + dashboard KPI match |
| `provision_public_trial` blocked | `20260830220000` | ✅ | RPC raises / 400 |
| `get_gold_ledger_page` | `20260830270000` etc. | ❌ | PGRST202 404 |
| `check_api_rate_limit` | `20260830160000` | ❌ | PGRST202 404 |
| `resolve_document_share` | `20260830160000` | ❌ | 42501 permission denied |
| `item_groups` table | `20260830280000` | ❌ | REST 404 |
| `mark_my_portal_kyc_doc` | `20260830190000` | ❓ | Not probed authenticated — **owner must apply migrations** |

See [`MIGRATIONS_APPLIED_VERIFICATION.json`](MIGRATIONS_APPLIED_VERIFICATION.json).

---

## Portal / KYC chain

| Link | Status | Notes |
|------|--------|-------|
| Portal login routes | EXISTS | customer/karigar/supplier-login |
| KYC upload UI | EXISTS | `PortalKycPanel`, attachments store |
| `mark_my_portal_kyc_doc` RPC | LOCAL ONLY | Migration not applied on QA |
| R2/storage upload | PARTIAL | Needs live portal session test |
| Public doc `/doc/$token` | EXISTS | `portalFirm()` helpers |

**BLOCKER:** Migrations must be applied before KYC chain can be E2E verified on QA.

---

## Blockers (explicit)

| BLOCKER | REASON | AFFECTED AREA | REQUIRED ACTION |
|---------|--------|---------------|-----------------|
| QA migration apply | `supabase db push` drift / owner gate | Gold ledger, rate limits, document hosting, item groups, KYC RPC | Owner applies pending migrations on `dqgrrafuoxaorvyrcuuh` |
| Meena / NN202000 spec | No authoritative rules | MTG, Meena book | Owner spec — do not invent |
| Remaining route drift | ~57 shop route chunks vs editable | attendance, purchases, whatsapp settings, workshop slips, etc. | Controlled extract restore + deps + browser verify |
| Prod E2E moratorium | Shop baseline lock | Production deploy | No deploy over `maatarajewellers.shop` |

---

## Fixes applied this continuation

1. **Delayed orders parity (code):** shop-aligned bucket fetch in `fetchHomeDashboardSummary`; removed store re-merge; orders cache 500; RLS-only bucket query.
2. **Route batch restore:** 13 routes + deps (`operational-books`, `party-search-select`, `partyCode`, `loadError`).
3. **Migration verifier fixed:** `scripts/verify-migrations-applied.mjs` uses correct RPC signatures.
4. **Probe script:** `scripts/probe-delayed-orders.mjs` — REST confirms 412 delayed on QA.
5. **Route drift:** 57 → **21** remaining divergences.

## Fixes applied earlier session

1. `HOME_ROW_LIMIT` 120 → **500** (`home-dashboard-query.ts`) — necessary but insufficient alone.
2. **`stock.entry.tsx`** restored from shop extract.
3. **`billing.purchases.index.tsx`**, **`attendance.index.tsx`**, **`settings.whatsapp.tsx`** restored from extract.
4. Audit scripts: `parity-frozen-vs-editable.mjs`, `verify-migrations-applied.mjs`.
5. Evidence: `PARITY_SIDE_BY_SIDE.json`, this document.

---

## Mismatch register (historical — stock.entry etc.)

### stock.entry.tsx — **FIXED**

**NOT PASS.** Green CI and dashboard KPI parity are necessary but not sufficient. Functional parity requires:

- Owner migration apply on QA
- Browser verification of restored routes (stock entry, purchases, attendance, WhatsApp settings)
- Portal/KYC E2E after migrations
- Remaining route-by-route restore from extract where byte ratio < 0.85
- Print/PDF live output comparison against frozen behaviour

Do not declare PASS until the above have evidence.
