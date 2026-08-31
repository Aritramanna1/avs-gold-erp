# Supabase Egress Investigation Report — dqgrrafuoxaorvyrcuuh

**Date:** 2026-08-30  
**Billing period usage:** 10.60 GB used / 5 GB included (+5.60 GB overage)  
**Paying tenants:** 0

Legend: **CONFIRMED** | **LIKELY** | **NOT YET MEASURED** | **BLOCKED**

---

## Executive summary

The egress overage is **CONFIRMED** to be primarily **application-generated waste**, not legitimate multi-tenant production load. The dominant source was **localhost development and QA** continuously calling production Supabase REST/Auth/Realtime, amplified by HMR reload loops, auth re-bootstrap, and full JSONB table re-downloads.

**Do not upgrade Supabase or migrate the database** until daily egress stays low after deploy + 48h idle monitoring.

---

## 1. Top egress sources (ranked)

| Rank | Source | Class | Status | Evidence |
|------|--------|-------|--------|----------|
| 1 | `npm run dev` + Vite HMR → `startCloudSync()` | REST + Auth | **CONFIRMED** | Port 3000/5173 processes; `.env.local` → prod; ~1,718 req/min peak |
| 2 | Boot `data-loader` parallel JSONB pulls (25+ tables) | REST | **CONFIRMED** | `pullOrders`, `pullJobCards`, `pullInventory`, `pullInvoices`, `pullPeople`… |
| 3 | Realtime `postgres_changes` → full table re-pull | REST + Realtime | **CONFIRMED** | Was 30+ tables; each write re-downloaded JSONB slices |
| 4 | Auth `TOKEN_REFRESHED` → full boot | Auth + REST | **CONFIRMED** | ~347 auth/min sustained; fixed in `auth-gate.tsx` |
| 5 | Playwright/parity QA via localhost | REST + Auth | **CONFIRMED** | Traces in `e2e/test-results/` |
| 6 | RLS initplan miss → COUNT 57014 → client retries | REST | **CONFIRMED** | `gold_ledger` COUNT 19.9s timeout; fixed live DB |
| 7 | Customer ledger context 5×1000 row pulls | REST | **CONFIRMED** | `customer-ledger-context.ts`; reduced to 120/table |
| 8 | Unbounded manufacturing barcodes refresh | REST | **CONFIRMED** | No limit; capped at 300 + firm filter |
| 9 | Attachment presign all files on boot | Storage/R2 proxy | **LIKELY** | Was parallel presign; capped at 20 |
| 10 | Edge comm scheduler per open tab | Edge Functions | **LIKELY** | 15–60 min invoke; gated in dev |

**NOT primary:** Supabase Storage bulk egress (**LIKELY** low — file uploads/downloads route through **Cloudflare R2 proxy**, not Supabase Storage API for hot paths per `supabase-storage.ts`).

---

## 2. Endpoint / frequency / size matrix

| SOURCE | ENDPOINT / RPC | FREQUENCY (storm) | RESPONSE SIZE | NECESSARY? |
|--------|----------------|-------------------|---------------|------------|
| Dev HMR boot | `/rest/v1/orders?select=data&limit=120` | Every reload | 500 KB–2 MB | No (dev) |
| Dev HMR boot | `/rest/v1/job_cards`, `/inventory`, `/invoices`… | Every reload | 1–5 MB combined | No (dev) |
| Auth refresh loop | `/auth/v1/token` | ~347/min | Small × volume | Partial (prod only) |
| Login boot | `rpc/get_authorization_context` | Every boot/HMR | ~2–10 KB | Yes (once) |
| Dashboard | `rpc/get_home_dashboard_summary` | Every `/app` | ~1 KB RPC | Yes |
| Dashboard buckets | `/rest/v1/orders` + `/job_cards` lazy | On dashboard | ~120 rows | Yes (lazy) |
| Gold ledger report | `rpc/get_gold_ledger_page` | Per page | 100 rows/page | Yes |
| Gold ledger (old) | HEAD COUNT full table | Retries | Timeout | **Removed** |
| Realtime | WebSocket + 9 table channels | Persistent tab | Control + triggers REST | Yes (prod, debounced) |
| Customer view | 5× `/rest/v1/*/select=data` | Per customer open | Up to 600 rows | Partial (was 5000) |
| Playwright | Full boot chain | Per test | Multi-MB | No |

Per-login boot (optimized production): **~0.5–2 MB REST** (CONFIRMED design target).  
Dev HMR (pre-fix): **~2–8 MB per reload** (CONFIRMED).

---

## 3. Development → production traffic

| Control | Status |
|---------|--------|
| `scripts/dev-egress-guard.mjs` blocks `npm run dev` against prod | **CONFIRMED** applied |
| `supabase-egress-guard.ts` blocks REST/Auth/Storage/Edge in dev | **CONFIRMED** applied |
| `autoRefreshToken: false` when quarantined | **CONFIRMED** applied |
| Playwright hard-block prod unless `ALLOW_PROD_E2E=1` | **CONFIRMED** applied |
| Dev servers killed (3000/5173) | **CONFIRMED** (repeated — close Cursor terminals) |
| Separate QA Supabase project | **NOT YET MEASURED** — recommended, not created |

---

## 4. Auth findings

| Finding | Status | Fix |
|---------|--------|-----|
| `TOKEN_REFRESHED` re-ran full boot | **CONFIRMED** | Skip in `auth-gate.tsx` |
| `TOKEN_REFRESHED` re-loaded roles | **CONFIRMED** | Skip in `rbac.ts` |
| `autoRefreshToken` in open dev tabs | **CONFIRMED** | Disabled under quarantine |
| Multiple `onAuthStateChange` listeners | **LIKELY** | Auth-gate is canonical boot; others UI-only |
| Single Supabase client singleton | **CONFIRMED** | `getRawSupabaseClient()` |

Production auth unchanged when `import.meta.env.DEV === false`.

---

## 5. Realtime findings

| Subscription | Table | Required? | Fix |
|--------------|-------|-----------|-----|
| `erp-core-changes` | people, gold_ledger, orders, job_cards, inventory | Yes | Debounce 2–3s |
| | invoices | Yes | Skipped in DEV |
| | app_settings, module_states | Yes | Filtered |
| | stock_movements, melt_jobs, mfg_bills | Partial | Deferred hydrate only |
| `wa-inbox-{firm}` | whatsapp | Route-specific | On inbox route only |
| `support-thread-{id}` | support | Route-specific | On support settings |

| Issue | Fix |
|-------|-----|
| Reconnect storm | Exponential backoff, max 8 attempts |
| Boot duplicate pulls | 45s boot grace period |
| Dev websocket egress | Realtime off unless `VITE_ENABLE_DEV_SUPABASE=1` |

---

## 6. Database / RPC findings

| Issue | Status | Fix |
|-------|--------|-----|
| RLS per-row `my_firm_id()` | **CONFIRMED** | Live migration `20260830140000` |
| `gold_ledger` COUNT 57014 | **CONFIRMED** | 589ms after fix; RPC rows-first |
| Full-table `refresh()` on ledger report mount | **CONFIRMED** | Removed; RPC pagination only |
| `ledger-store.refresh()` 20k pagination | **CONFIRMED** | Cap 1000 via RPC |
| Customer context 5000 rows | **CONFIRMED** | Cap 120/table |
| Manufacturing barcodes unbounded | **CONFIRMED** | Cap 300 |
| Boot JSONB limits | **CONFIRMED** | 120–200 rows/table |
| Server RPC rate limits | **NOT YET MEASURED on live** | Migration `20260830160000` (apply via owner) |

---

## 7. Reports / dashboard

| Surface | Pattern | Fix |
|---------|---------|-----|
| Dashboard KPIs | `get_home_dashboard_summary` RPC | Firm-scoped, single call |
| Delivery buckets | Lazy 120-row order slice | Split from KPI |
| Gold ledger report | `fetchGoldLedgerPage` 100/page | No mount full refresh |
| Billing index | Paginated query | Removed duplicate 200-row refresh |
| Dashboard fallback | 8 parallel COUNTs | Only on RPC missing/timeout |

---

## 8. Storage findings

| Path | Authority | Egress billed to |
|------|-----------|------------------|
| Attachments, logos, KYC, PDF embed | **Cloudflare R2** via `VITE_R2_PROXY_URL` | **Hostinger/Cloudflare** (R2 egress free) |
| Legacy `attachments` table metadata | Supabase REST | Supabase (small JSON) |
| Embedded base64 in old `attachments.data` | Supabase REST | Supabase (**LIKELY** legacy tail) |

**Hostinger opportunity:** Public shop assets on `maatarajewellers.shop` already off Supabase. Private docs stay on authenticated R2 proxy — **do not** expose via unrestricted public URLs.

Moving file **delivery** to Hostinger CDN reduces **R2/Hostinger** bandwidth, **not** Supabase REST/RPC/Auth/Realtime egress.

---

## 9. Rate limits applied

### Client (production + dev when enabled)

| Layer | Limit |
|-------|-------|
| REST fetch throttle | 10 req / 10s, 400ms gap, GET dedupe |
| Auth fetch throttle | 6 req / 10s |
| Dev egress guard | Block all prod billable paths |
| Realtime reconnect | Max 8 attempts, exponential backoff |

### Server (migration file — **NOT YET MEASURED live**)

| RPC | Limit |
|-----|-------|
| `get_authorization_context` | 120 / user / 60s |
| `get_gold_ledger_page` | 90 / user / 60s |

Apply: `supabase db query --linked < supabase/migrations/20260830160000_egress_rate_limit_hot_rpcs.sql`  
(Never commit `SUPABASE_DB_PASSWORD`; set in secure shell only.)

---

## 10. Monitoring instrumentation

| Tool | Status |
|------|--------|
| `src/lib/monitoring/supabase-egress-monitor.ts` | **CONFIRMED** added |
| Wired into `supabase-fetch-throttle.ts` | **CONFIRMED** |
| Dev console: `window.__ORNEXA_EGRESS__.snapshot()` | **CONFIRMED** |
| Supabase dashboard hourly chart | **NOT YET MEASURED** post-fix (wait 48h) |
| `supabase inspect db outliers/calls` | **BLOCKED** — needs `SUPABASE_DB_PASSWORD` |

Monitor tracks: request count, path, class, bytes, dedupe, blocked — **no tokens/passwords**.

---

## 11. Fixes applied (code)

| File | Change |
|------|--------|
| `scripts/dev-egress-guard.mjs` | Block dev start against prod |
| `supabase-egress-guard.ts` | Network-level dev quarantine |
| `supabase-fetch-throttle.ts` | Throttle + dedupe + monitor |
| `client.ts` | No autoRefresh in quarantine |
| `auth-gate.tsx` | Skip TOKEN_REFRESHED boot |
| `rbac.ts` | Skip TOKEN_REFRESHED roles reload |
| `data-loader.ts` | Boot limits, deferred pulls, abort retry removed |
| `realtime-sync.ts` | 9 tables, debounce, boot grace, reconnect cap |
| `customer-ledger-context.ts` | 1000→120 rows/table |
| `manufacturing-barcode-store.ts` | Unbounded→300 |
| `billing.index.tsx` | Paginated only |
| `reports.gold-ledger.tsx` | RPC pagination only |
| `storage.ts` | Presign cap 20 |
| `playwright.config.ts` | Prod block |

### Live DB (already applied)

| Migration | Effect |
|-----------|--------|
| `20260830140000_rls_initplan_cpu_fix.sql` | RLS initplan, dashboard RPC |

### Pending live apply

| Migration | Effect |
|-----------|--------|
| `20260830160000_egress_rate_limit_hot_rpcs.sql` | Server RPC rate limits |

---

## 12. Before / after measurements

| Metric | Before (storm) | After (expected) | Measured post-fix? |
|--------|----------------|------------------|-------------------|
| Total req/min | ~1,718 | <10 idle | **NOT YET MEASURED** |
| Auth req/min | ~347 | <2 idle | **NOT YET MEASURED** |
| API Gateway/min | ~818 | <5 idle | **NOT YET MEASURED** |
| Daily egress | ~1.8 GB peak (Aug 28–29) | <50–100 MB/day | **NOT YET MEASURED** |
| Billing period total | 10.60 GB | Cannot decrease | **CONFIRMED** |
| `count:gold_ledger` | 19.9s / 57014 | 589ms | **CONFIRMED** (probe) |
| Dashboard RPC | 729ms | 258ms | **CONFIRMED** (probe) |
| `npx tsc --noEmit` | — | Pass | **CONFIRMED** |
| `npm run build` | — | Pass | **CONFIRMED** (prior session) |

---

## 13. Verification checklist (functional)

| Check | Status |
|-------|--------|
| Login / auth | **NOT YET MEASURED** (no prod load test) |
| Dashboard KPIs | **CONFIRMED** same shape pre/post RLS fix |
| Gold ledger pagination | **CONFIRMED** code path |
| Billing paginated list | **CONFIRMED** code path |
| RLS / tenant isolation | **CONFIRMED** not weakened |
| Portals | **NOT YET MEASURED** |
| PDF/print | **LIKELY** R2 path unchanged |

---

## 14. Remaining risks

1. **App fixes not deployed** — production bundle may still run old boot behavior
2. **Dev server auto-restart** — Cursor/terminals may relaunch Vite on 5173
3. **Historical 10.60 GB** — already billed for period
4. **Server rate limit migration** — file ready, not applied live
5. **No isolated QA project** — dev may tempt prod hits if guard bypassed

---

## 15. Is infrastructure migration justified?

**No — not yet.**

| Option | When |
|--------|------|
| Stay Supabase Free + stop waste | **Now** (default) |
| Second free Supabase project for QA | When dev needs cloud again |
| R2 for all binaries | Already primary; finish legacy attachment cleanup |
| Hostinger CDN for public marketing PDFs | Optional; affects Hostinger bandwidth only |
| Supabase Pro ($25, 250 GB egress) | When **real paying tenants** exist and measured usage exceeds free |
| Neon / self-host | Only if Supabase platform cost exceeds ops burden **after** optimization |

---

## 16. Owner actions required

1. **Close all `npm run dev` terminals** — verify ports 3000/5173 closed
2. **Deploy** current build to production host
3. **Wait 48h** — watch Supabase egress daily chart (hourly refresh)
4. **Apply** `20260830160000_egress_rate_limit_hot_rpcs.sql` via secure `supabase db query --linked`
5. **Create** second Supabase free project for QA (optional, recommended)
6. **Do not** run Playwright/parity/load against `dqgrrafuoxaorvyrcuuh`

---

## 17. Normal ERP target state

```
NORMAL ERP USAGE
→ one login boot (~0.5–2 MB REST)
→ debounced realtime (9 core tables)
→ paginated reports/ledger
→ lazy dashboard buckets
→ R2 for file bytes (zero Supabase Storage egress on hot path)
→ no dev traffic to production
→ no request loops
→ no egress storms
```

---

## 18. Mandatory engineering rules (2026-08-30)

Incorporated permanently into the master implementation plan as **REQUIRED** rules (not optional optimization). Full text: `docs/MASTER/SUPABASE_EGRESS_ENGINEERING_RULES.md`.

| # | Rule | Code status |
|---|------|-------------|
| 1 | One login = one controlled boot | **APPLIED** — removed duplicate `pullAll`+`startCloudSync` in tenant + auth context stores |
| 2 | Dedupe auth + subscription | **APPLIED** — subscription gate, restoreLastOrSelect |
| 3 | Never fetch secrets at boot | **APPLIED** — branch SMTP RPC deferred |
| 4 | Auth request optimization | **PARTIAL** — `pullAppSettings` uses `getSession()`; full audit open |
| 5 | Realtime boot order | **APPLIED** — after background pull + 45s grace |
| 6 | R2 / Storage | **CONFIRMED** — app uses R2 proxy; dashboard Storage counts need log correlation |
| 7 | Warnings/errors from logs | **OPEN** — 36 warnings + 2 Postgres errors need Supabase Logs export (not guessed) |
| 8 | Boot egress monitoring | **APPLIED** — `window.__ORNEXA_EGRESS__.snapshot()` / `.loginSummary()` |
| 9 | Hard before/after acceptance | **OPEN** — `_reconstruction/EGRESS_BEFORE_AFTER.md` template; measurement pending |
| 10 | Production safety | **ENFORCED** — dev egress guard, no prod Playwright storms |
| 11 | Performance ≠ broken functionality | **REQUIRED** |
| 12 | Final acceptance gate | **NOT PASS** until numeric evidence + 48h stable egress |

**Next owner action:** One controlled production login → paste `loginSummary()` into `EGRESS_BEFORE_AFTER.md` → compare to pre-optimization baseline (648 API / 68 Auth in 1h window with 2 logins = ~300/login pre-fix estimate — must be replaced with instrumented per-login numbers).
