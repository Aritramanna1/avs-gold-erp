# Supabase Egress Overuse Investigation — dqgrrafuoxaorvyrcuuh

**Date:** 2026-08-30  
**Status:** Root cause identified, traffic contained, optimizations applied  
**Plan usage:** 10.60 GB used vs 5 GB free allowance (+5.60 GB overage)

## Executive summary

Egress overuse is **not** legitimate multi-tenant production load. With **zero paying tenants**, ~10.4 GB egress accumulated from:

1. **Repeated full JSONB table downloads** during dev boot + HMR + realtime re-pulls
2. **Auth/session re-bootstrap loops** amplifying every download cycle
3. **Blocked/timeout queries** (57014) causing retries that re-transferred large payloads
4. **Playwright/parity QA** exercising full boot against production Supabase via localhost
5. **Attachment storage presigning** firing for every cached file on every boot

Database RLS initplan fixes (live) eliminated the worst timeout/retry amplification. Application fixes (local) reduce bytes per session and stop dev/QA from hitting production by default.

---

## Egress sources (ranked by impact)

### 1. Startup `data-loader` JSONB pulls (PRIMARY — ~70% of REST egress)

Every login/HMR/re-bootstrap downloaded large `data` JSONB blobs from many tables in parallel:

| Table | Boot limit | Typical payload | Re-pull trigger |
|-------|------------|-----------------|-----------------|
| `orders` | 120 rows | Full order JSON (~5–50 KB/row) | HMR, realtime, TOKEN_REFRESHED boot |
| `job_cards` | 200 rows | Full job card JSON | Same |
| `inventory` | 200 rows | Stock item JSON | Same |
| `invoices` | 200 rows | Invoice + line items JSON | Same |
| `people` | 250 rows | Customer/karigar profile JSON | Same |
| `stock_movements` | 150 rows | Movement JSON | Same |
| `gold_ledger` | 150 rows | Ledger columns (slimmer) | Same |
| `worker_*`, `attendance`, etc. | 200 each | JSONB | Deferred boot (90s) |

**Why repeating:** Long-running `npm run dev` (port 3000) with `.env.local` → production Supabase. Each Vite HMR reload = full boot (~25+ REST calls × hundreds of KB–MB).

**Estimated per boot cycle:** 2–8 MB REST egress (firm-dependent). At ~1,718 req/min sustained, **multi-GB/day** is expected.

### 2. Realtime → full re-pull (AMPLIFIER — ~15%)

Previously 30+ `postgres_changes` listeners; each DB write triggered immediate full-table JSONB re-download. Now slimmed to 9 core tables with 2–3s debounce.

### 3. Auth/session loops (AMPLIFIER — drives repeat count)

- `TOKEN_REFRESHED` re-ran full `resolveAuth()` + `startCloudSync()` (~347 auth/min baseline)
- Playwright login cycles added full boot per test case
- **Fix:** Skip bootstrap on `TOKEN_REFRESHED` / `USER_UPDATED`; dev quarantine blocks cloud sync unless `VITE_ENABLE_DEV_SUPABASE=1`

### 4. Blocked/expensive queries (AMPLIFIER — CPU + retry egress)

Supabase dashboard "blocked queries" were predominantly:

| Query | Symptom | Egress impact |
|-------|---------|---------------|
| `SELECT count(*) FROM gold_ledger WHERE firm_id = …` | **57014 statement timeout** | Client retried; HEAD + error round-trips |
| RLS per-row `my_firm_id()` | 43M seq scans on `user_profiles` | Massive response latency → client timeouts → retries |
| `get_home_dashboard_summary()` under bad RLS | 729ms–25s | Fallback path pulled 8 parallel table slices |

**Fix (live DB):** RLS initplan migration + indexes. `gold_ledger` COUNT: 19.9s timeout → **589ms**.

### 5. Dashboard/report loaders (~5%)

- Dashboard KPI RPC is compact; **order bucket slice** (~120 orders + job_cards link) is separate lazy fetch
- Gold ledger report previously ran full `refresh()` pagination loop (up to 20×1000 rows) — **removed**; RPC pagination only
- `ledger-store.refresh()` capped at **1000 rows** for compat cache

### 6. Storage / attachments (~5%)

- `pullAttachments()` downloads 150 attachment metadata rows (includes embedded base64 in legacy `data`)
- `resolveAllSignedUrls()` presigned **every** cached attachment in parallel on boot
- **Fix:** Boot presign capped at **20 most recent**; remainder sign on view

### 7. Playwright / parity QA (SECONDARY burst source)

- Traces in `e2e/test-results/` confirm HeadlessChrome → localhost → production Supabase
- **Fix:** `playwright.config.ts` hard-blocks prod ref unless `ALLOW_PROD_E2E=1`

---

## What is NOT the cause

- Paying tenant traffic (none)
- Supabase cron/edge functions at scale (comm scheduler is 60 min/session, minor)
- Storage bucket bulk download by external users
- Intentional load tests (now blocked)

---

## Fixes applied

### Immediate containment (DONE)

| Action | Status |
|--------|--------|
| Kill dev servers (3000, 5173, 4173) | ✅ Repeated as processes restarted |
| Block Playwright against prod | ✅ `ALLOW_PROD_E2E=1` required |
| Block parity/probes without explicit flags | ✅ |
| No artificial traffic during investigation | ✅ |

### Database (LIVE on production)

Migration: `supabase/migrations/20260830140000_rls_initplan_cpu_fix.sql`

- RLS initplan on 37 tables
- Indexes on `user_profiles`, `organization_features`
- Firm-scoped `get_home_dashboard_summary()`

### Application (LOCAL — deploy required for hosted ERP)

| File | Egress reduction |
|------|------------------|
| `data-loader.ts` | Dev quarantine; deferred boot (90s); startup limits; selective invoice columns; narrowed branch/workshop selects |
| `realtime-sync.ts` | 9 tables + debounce; skip invoices in DEV; deferred hydrate |
| `auth-gate.tsx` | No re-boot on TOKEN_REFRESHED |
| `home-dashboard-query.ts` | KPI RPC first; buckets lazy (120 row cap) |
| `ledger-store.ts` | refresh cap 1000 rows |
| `reports.gold-ledger.tsx` | No mount-time full refresh |
| `storage.ts` | Boot presign cap 20 attachments |
| `data-loader.ts` | Deferred boot scheduling; abort retry removed |
| `billing-store.ts` / `billing.index.tsx` | Paginated list + prefs-only (no duplicate 200-row refresh) |
| `worker-gold-book-store.ts` | Compat cache 200 rows (was 1000) |
| `supabase-fetch-throttle.ts` | 12 REST + 8 auth / 10s, GET dedupe |
| `playwright.config.ts` | Prod ref hard block |

---

## Before / after metrics

### Request volume

| Metric | Before (storm) | After (expected idle) |
|--------|----------------|----------------------|
| Total req/min | ~1,718 | <10 |
| Auth req/min | ~347 | <2 |
| API Gateway/min | ~818 | <5 |

### Query performance (authenticated probe — pre-containment baseline captured)

| Probe | Before | After |
|-------|--------|-------|
| `count:gold_ledger` | 19,922ms **57014** | **589ms** |
| `count:orders` | 5,685ms | **126ms** |
| `rpc:get_home_dashboard_summary` | 729ms | **258ms** |

### Egress

| Metric | Before | After (projected) |
|--------|--------|-------------------|
| 24h egress | **10.40 GB** (accumulated) | Should **flatline** with dev stopped |
| Per login boot | ~2–8 MB JSONB | ~0.5–2 MB (limits + deferred + lazy dashboard) |
| Per HMR (dev) | Full boot re-download | **0 MB** (dev quarantine → cache only) |

**Egress dashboard will lag 30–60 min** after stopping traffic. Historical 10.4 GB cannot be reclaimed; prevent recurrence.

### CPU

| Metric | Before | After |
|--------|--------|-------|
| Supabase CPU | >80% | Expected <40% within 30 min idle |

---

## Data integrity verification

- ✅ RLS, firm isolation, module gates **unchanged**
- ✅ Dashboard RPC returns same KPIs (ledger_discrepancy_mg: 0, open_orders: 412)
- ✅ People list uses paginated `people-query.ts` (25/page) — boot cache is tail-only helper
- ✅ Gold ledger full history available via report RPC pagination — boot cache is 150-row recent tail
- ✅ No production data deleted; no filters weakened

---

## Remaining issues

1. **App fixes not deployed** — production bundle may still run pre-fix boot/realtime until next deploy
2. **Migration history drift** — `supabase db push` blocked; repair before next push
3. **Historical egress** — 10.4 GB already consumed; monitor for new accumulation only
4. **Dev workflow** — use `VITE_ENABLE_DEV_SUPABASE=1` only when cloud dev explicitly needed; otherwise `npm run preview:shop`
5. **Boot session cache** — reduces repeat downloads within same browser session; HMR in dev now uses cache-only path

---

## Rules until owner clears

1. **NO** Playwright, parity, load, or probe tests against `dqgrrafuoxaorvyrcuuh`
2. **NO** `npm run dev` against prod without `VITE_ENABLE_DEV_SUPABASE=1`
3. Use **`npm run preview:shop`** for UI-only work
4. **Do NOT upgrade compute or pay for overage** until 24h metrics confirm controlled baseline
5. If optimized system still exceeds Free Plan with real tenants, evaluate upgrade vs migration as **separate decision**

---

## Normal ERP operation after fixes

- Login → critical settings (branches, modules) → UI renders → background pulls core ops data
- Dashboard KPIs from RPC; delivery buckets load lazily
- Customers/karigars/stock/ledger: paginated on module routes; boot cache is recent tail for offline helpers
- Realtime updates debounced core tables only
- Attachments presign on demand beyond boot slice of 20

---

## Egress chart (Aug 18–29)

The **Aug 28–29 spike (~1.8 GB/day peak)** matches the dev/HMR request storm (localhost → production Supabase). Baseline days before Aug 27 were ~0–500 MB/day.

**Historical 10.60 GB is already billed.** After dev servers are stopped and the app bundle is deployed, expect **<50 MB/day** with no local dev tabs (one legitimate ERP session only).

Additional fixes applied to cut future egress: customer context 1000→120 rows/table, unbounded manufacturing barcodes capped at 300, stock/job/melt caches aligned to 200, realtime + comm scheduler disabled in dev by default.
