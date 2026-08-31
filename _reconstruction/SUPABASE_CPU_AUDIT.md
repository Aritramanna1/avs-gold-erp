# Supabase CPU Investigation — dqgrrafuoxaorvyrcuuh

**Date:** 2026-08-30  
**Status:** Root cause fixed on live DB + app optimizations applied locally

## Executive summary

CPU >80% with no paying tenants was **not a compute sizing issue**. The database was burning CPU on **RLS initplan misses**: `my_firm_id()` and `tenant_module_write_allowed()` were evaluated **once per row** on every query, causing tens of millions of sequential scans on tiny lookup tables.

| Table | Rows | Seq scans (before) |
|-------|------|-------------------|
| `user_profiles` | 34 | **43,446,739** |
| `organization_features` | 226 | **6,534,536** |
| `gold_ledger` | 2,359 | 13,241 |
| `orders` | 1,042 | 20,834 |

## Top CPU-heavy query patterns (identified)

| # | Pattern | Executions evidence | Avg time (before) | Root cause |
|---|---------|---------------------|-----------------|------------|
| 1 | `SELECT count(*) FROM gold_ledger WHERE firm_id = …` (PostgREST HEAD) | Every startup `pullPayments`, dashboard fallback, report COUNT | **19–25s → 57014 timeout** | RLS called `my_firm_id()` + `tenant_module_write_allowed('bullion')` per row |
| 2 | `my_firm_id()` via RLS on all firm-scoped tables | 43M seq scans on `user_profiles` | sub-ms × millions | No `(select …)` initplan wrapper in policies |
| 3 | `organization_feature_enabled()` via RLS | 6.5M seq scans on `organization_features` | sub-ms × millions | Same initplan miss; chained from `tenant_module_write_allowed` |
| 4 | `get_home_dashboard_summary()` | Dashboard mount | 729ms–25s (timeout path) | Full-table aggregate on `gold_ledger` under expensive RLS |
| 5 | `get_gold_ledger_page()` COUNT leg | Ledger refresh loop (up to 20 pages) | 8–10s per page pre-index | COUNT before rows + RLS per-row helpers |
| 6 | `useLedger.refresh()` pagination loop | Report pages, post-append | N × RPC latency | Client fetched up to 20×1000 rows on every refresh |
| 7 | Realtime `postgres_changes` → immediate pulls | 30+ table subscriptions | Burst on any write | No debounce on high-volume tables |
| 8 | `pullPayments()` HEAD COUNT | Startup + realtime | Full payments scan | No-op count with no consumer |
| 9 | Dashboard fallback parallel COUNTs | RPC timeout/missing | 8 parallel requests | Fallback only; RPC now fast |
| 10 | Playwright E2E | Single worker, localhost | Not continuous prod load | Uses same project but not 24/7; not primary CPU driver |

## Fixes applied

### Database (live — applied via `supabase db query --linked`)

Migration file: `supabase/migrations/20260830140000_rls_initplan_cpu_fix.sql`

1. Indexes: `idx_user_profiles_auth_active`, `idx_organization_features_org_key`
2. Rewrote firm-scoped RLS on 37 core tables using initplan pattern:
   `firm_id = (select public.my_firm_id())` instead of `firm_id = public.my_firm_id()`
3. Rewrote `gold_ledger` + `invoices` policies with initplan module gates
4. Optimized `organization_feature_enabled` / `tenant_module_write_allowed` internals
5. Firm-scoped `get_home_dashboard_summary()` (explicit `firm_id` filter in CTEs)

**Note:** `supabase db push` blocked by remote-only migration history drift; SQL applied directly. Local migration file is canonical for future repair/sync.

### Application (local — requires deploy)

| File | Change |
|------|--------|
| `src/lib/ledger-store.ts` | `refresh()` capped to 1000 rows (was up to 20k via pagination loop) |
| `src/lib/realtime-sync.ts` | 750ms debounce on people/ledger/orders/job_cards/inventory/stock/invoices/payments pulls |
| `src/routes/reports.gold-ledger.tsx` | Removed mount-time full `refresh()`; report uses RPC pagination only |
| `src/lib/data-loader.ts` | Removed no-op `pullPayments()` COUNT scan |

Prior migration already live: `20260830120000_gold_ledger_page_perf.sql` (rows-first RPC, COUNT timeout → `total: -1`).

## Before / after performance (authenticated E2E user, firm f9f73cce…)

Probe: `node _reconstruction/supabase-cpu-audit.mjs`

| Probe | Before | After | Δ |
|-------|--------|-------|---|
| `count:gold_ledger` | 19,922ms **57014** | **589ms** (2354 rows) | **~34× faster, timeout eliminated** |
| `count:orders` | 5,685ms | **126ms** | ~45× |
| `count:stock_movements` | 6,211ms **57014** | **385ms** | timeout eliminated |
| `count:people` | 381ms | **118ms** | ~3× |
| `rpc:get_home_dashboard_summary` | 729ms | **258ms** | ~3× |
| `rpc:get_gold_ledger_page` | 536ms–10,544ms | **836ms** | stable sub-second |
| `rpc:get_party_ledger_summary` | 72ms | **88ms** | unchanged |

`diagnose-counts.mjs` total wall time: **~25s → ~2.3s**.

## Verification checklist

- [x] `gold_ledger` COUNT no longer 57014
- [x] Dashboard RPC returns same shape (ledger_discrepancy_mg: 0, open_orders: 412)
- [x] Party ledger summary unchanged
- [x] `npm run build` pass
- [x] RLS/security not disabled; firm scope + module gates preserved
- [x] No data deleted; no schema invented beyond indexes + policy/RPC replacements
- [ ] Deploy app changes to production bundle
- [ ] Monitor Supabase CPU dashboard 24h post-fix

## Remaining CPU pressure (expected)

1. **Historical seq-scan debt** — stats will decay; watch `user_profiles` / `organization_features` seq_scans over 24h
2. **Realtime subscription baseline** — idle clients still hold channels; debounce reduces write amplification
3. **Audit/platform tables** — `audit_log` (8234 rows), `platform_error_events` moderate scan counts; not hot path
4. **Migration history drift** — repair `supabase migration repair` before next `db push`
5. **Compute upgrade** — defer until 24h CPU graph confirms baseline <40%

## Do not upgrade compute yet

Optimize first ✅ — root cause addressed. Re-evaluate compute only if CPU stays >60% after 24h with no E2E/QA running.

## Supabase CLI query statistics (optional)

`supabase inspect db outliers` and `supabase inspect db calls` require a direct Postgres
login role. If these fail with:

```
password authentication failed for user "cli_login_postgres" (SQLSTATE 28P01)
```

configure **`SUPABASE_DB_PASSWORD`** in the shell environment (never in source code,
`.env.local`, Git, logs, or committed files):

```powershell
# Owner-only — run in a secure local shell, not in the repo
$env:SUPABASE_DB_PASSWORD = "<database password from Supabase dashboard → Settings → Database>"
npx supabase inspect db outliers --linked
npx supabase inspect db calls --linked
```

Performance work does **not** depend on these commands. Existing evidence (table stats,
RLS seq-scan counts, and `supabase-cpu-audit.mjs` before/after probes) is sufficient unless
new regressions appear after deploy.

## Verification status (2026-08-30)

- [x] RLS initplan migration applied on live DB
- [x] App: dev quarantine, auth TOKEN_REFRESHED skip, fetch throttle, realtime debounce
- [x] App: deferred boot scheduling (full boot + session-cache paths)
- [x] App: abort retry removed from data-loader (no duplicate pull egress)
- [x] App: billing/worker-gold-book cache limits aligned (200 rows)
- [x] `npx tsc --noEmit` pass
- [ ] `npm run build` pass (run after each batch)
- [ ] Deploy app bundle to production host
- [ ] Monitor Supabase dashboard 24h post-deploy (requests, egress, CPU)
- [ ] Repair migration history before next `supabase db push`
