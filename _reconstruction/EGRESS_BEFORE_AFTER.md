# Supabase Egress — Before/After Controlled Login Measurement

**Project:** dqgrrafuoxaorvyrcuuh (production — owner session only)  
**Rule:** One login = one measurement. No Playwright. No load tests.

---

## Measurement procedure

1. Close all ERP tabs except one fresh incognito window.
2. Open DevTools → Console.
3. Sign out fully, then sign in once (do not navigate aggressively during boot).
4. Wait until dashboard is interactive and boot banner clears (~30–60s on slow links).
5. Run:

```javascript
const s = window.__ORNEXA_EGRESS__.loginSummary();
const full = window.__ORNEXA_EGRESS__.snapshot();
console.table([s]);
console.log('topPaths', full.topPaths.slice(0, 15));
console.log('operations', full.operations);
```

6. Copy results into the tables below. **Do not include tokens, emails, or response bodies.**

---

## Baseline (BEFORE optimization wave)

| Field | Value |
|-------|-------|
| Date / time (IST) | |
| Measured by | |
| Git commit / branch | |
| User role | |
| Boot path | fresh login / session restore |

| Metric | Value |
|--------|-------|
| Total REST/API requests | |
| Auth requests | |
| Storage requests | |
| Realtime events | |
| Deduped requests | |
| Blocked requests | |
| Response bytes (approx) | |
| Boot duration (ms) | |
| Supabase dashboard API (1h window) | |
| Supabase dashboard Auth (1h window) | |
| Postgres errors (1h) | |
| Warnings (1h) | |

**Top paths (paste top 10 from snapshot):**

```
(paste)
```

**Notes / anomalies:**

---

## After optimization wave

| Field | Value |
|-------|-------|
| Date / time (IST) | |
| Measured by | |
| Git commit / branch | |
| User role | |
| Boot path | fresh login / session restore |

| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| Total REST/API requests | | | |
| Auth requests | | | |
| Storage requests | | | |
| Realtime events | | | |
| Deduped requests | | | |
| Blocked requests | | | |
| Response bytes (approx) | | | |
| Boot duration (ms) | | | |

**Acceptance:** All Rule 12 items in `docs/MASTER/SUPABASE_EGRESS_ENGINEERING_RULES.md` must pass with numeric evidence — not estimates.

---

## Code changes in this wave (2026-08-30)

| Change | File |
|--------|------|
| Removed `pullAll()` + `startCloudSync()` duplicate | `tenant-context-store.ts`, `authorization-context-store.ts` |
| Subscription/membership dedupe | `subscription-gate.tsx`, `tenant-context-store.ts` |
| No SMTP secret RPC at boot | `data-loader.ts` |
| `getSession()` in `pullAppSettings` | `data-loader.ts` |
| Realtime after background + boot grace | `realtime-sync.ts`, `data-loader.ts` |
| Per-login egress monitor | `supabase-egress-monitor.ts`, `auth-gate.tsx`, `app-loading-store.ts` |

**Post-deploy measurement slot:** _pending owner controlled login_

---

## Migration status (2026-08-30, project `dqgrrafuoxaorvyrcuuh`)

| Migration | Status | Method |
|-----------|--------|--------|
| `20260830170000_platform_database_health_observability.sql` | **APPLIED** | `supabase db query --linked` + schema_migrations |
| `20260830140000_rls_initplan_cpu_fix.sql` | **APPLIED** | `supabase db query --linked` + schema_migrations |
| `20260830120000_gold_ledger_page_perf.sql` | **APPLIED** (indexes existed) | schema_migrations recorded |
| `20260830160000_*` (rate limits / document hosting) | **Pre-existing on remote** | `egress_rate_limit_buckets` confirmed present |

`supabase db push` fails due to remote-only migration history drift (200+ versions not in local tree). Individual migrations applied via linked SQL exec.

---

## PostgreSQL error root causes (from `platform_error_events`, last 7 days)

Queried production DB directly — not guessed.

| Message pattern | Count (7d) | Root cause | Fix |
|-----------------|------------|------------|-----|
| `orders pull: canceling statement due to statement timeout` | 78 | Boot REST pull + concurrent batch queries under login storm | Sequential background pulls (batch=1); boot-aware fetch throttle |
| `gold_ledger pull: canceling statement due to statement timeout` | 62 | Same — parallel boot + RLS on ledger tail | RLS initplan migration applied; ledger limited to 150 rows at boot |
| `job_cards pull: canceling statement due to statement timeout` | 40 | Same | Sequential boot pulls |
| `worker_transactions pull: … timeout` | 34 | Same | Sequential boot pulls |
| `print_logs pull: … timeout` | 22 | Deferred pull competing with boot | Already in `pullBackgroundDeferred`; sequential batches |
| `Load gold_ledger failed [57014]` | 15 | On-demand ledger page COUNT before rows-first RPC | `get_gold_ledger_page` migration applied |

**24h error breakdown:** database=800, unknown=226, network=189, validation=47.

**Network category (189):** client `pullCritical` / `Failed to fetch` — caused by fetch-throttle queue + 25s AbortSignal during dev HMR reload storms. Fixed: boot-aware throttle (22 req/10s, 80ms gap during login boot window).

---

## Code fixes in this continuation (2026-08-30, pass 2)

| Change | Root cause addressed | File |
|--------|---------------------|------|
| Boot-aware fetch throttle | Network timeouts from throttle queue during login | `supabase-fetch-throttle.ts` |
| Sequential background boot pulls | Parallel REST causing 57014 on orders/ledger/job_cards | `data-loader.ts` |
| **firm_id on store refresh paths** | **Unscoped orders/job_cards/worker_transactions scans (limit 500–1000)** | `orders-store.ts`, `jobcards-store.ts`, `workers-store.ts`, `worker-gold-book-store.ts` |
| **firm_id on dashboard fallback** | Fallback RPC path missing tenant filter | `home-dashboard-query.ts` |
| In-flight pull dedupe | Boot + realtime duplicate fetches | `pull-dedupe.ts`, `data-loader.ts` |
| Ledger refresh limit 150 | Unbounded 1000-row ledger hydrate | `ledger-store.ts` |
| Partial indexes + dashboard RPC CTEs | COUNT/aggregate full scans | `20260830180000_boot_operational_query_perf.sql` |

**Migration `20260830180000`:** APPLIED — `idx_orders_firm_open_updated`, `idx_worker_transactions_firm_kind_ts`, hardened `get_home_dashboard_summary`.

**Dashboard measurement slot:** _pending — record KPI RPC time + total requests via `window.__ORNEXA_EGRESS__.loginSummary()` after one login to `/app`_

| Change | Effect |
|--------|--------|
| Wait for `criticalLoadDone` before dashboard fetch | Avoids racing empty firm/settings |
| In-flight dedupe on `fetchHomeDashboardSummary` | StrictMode / remount won't double RPC |
| AbortController cleanup on `/app` unmount | Cancels in-flight dashboard queries |
| Store-first order buckets when `initialLoadDone` | Skips duplicate orders/job_cards/people REST |
| Skip second bucket fetch when fallback already included buckets | Removes duplicate round-trip on RPC timeout |
| `firm_id` filter on dashboard bucket queries | Faster RLS evaluation |

**Dashboard measurement slot:** _pending — record KPI RPC time + total requests via `window.__ORNEXA_EGRESS__.loginSummary()` after one login to `/app`_

---

## Platform Owner monitors (2026-08-30)

| Surface | Path | Backend |
|---------|------|---------|
| Database Health | `/platform?view=health` → Database Health tab | RPC `get_platform_database_health` |
| Egress Monitor | `/platform?view=health` → Egress Monitor tab | RPC `get_platform_egress_observability` + client `__ORNEXA_EGRESS__` |
| Error Log | `/platform?view=health` → Error Log tab | Live `platform_error_events` table |

Migration required: `supabase/migrations/20260830170000_platform_database_health_observability.sql`

**Removed:** fabricated "API Uptime (proxy)" percentage from health view.

---

## Code fixes in this continuation (2026-08-30, pass 3)

| Change | Root cause addressed | File |
|--------|---------------------|------|
| CEO dashboard analytics firm-scoped (limit 300) | Unscoped manufacturing_bills/job_cards/worker_transactions scans | `ceo-dashboard-analytics.ts` |
| Assistant tools `requireFirmScopedTable` | Unscoped orders/invoices/inventory/job_cards/people queries | `assistant-tool-registry.ts` |
| Billing store refresh firm_id + `rowToInvoice` | Unscoped invoice cache; legacy rows missing payments/items arrays | `billing-store.ts`, `billing-query.ts` |
| Boot invoice pull uses `rowToInvoice` | Iterable errors on print/PDF for legacy invoices | `data-loader.ts` |
| Custom entity records firm-scoped (limit 500) | Unscoped 1000-row custom_entity_records hydrate | `custom-entities-store.ts` |
| Public `/verify/invoice/$token` route | QR URLs 404 — mint path had no matching route | `verify.invoice.$token.tsx` |

**Verification (pass 3):** `npx tsc --noEmit` PASS · `npm run qa:unit` 93/93 PASS · `npm run build` PASS

**Migration `20260830190000`:** APPLIED — `get_gold_ledger_page(p_order)`, COUNT only offset=0, `get_firm_ledger_balances`, `mark_my_portal_kyc_doc`.

| Change | Root cause addressed | File |
|--------|---------------------|------|
| Unified boot/refresh ledger via RPC desc | Oldest-150 vs newest-150 cache corruption | `data-loader.ts`, `ledger-store.ts` |
| `fetchGoldLedgerInRange` helper | PostgREST `count: exact` on report queries | `ledger-pagination.ts`, `gold-position-report-query.ts`, `gold-loss-report-query.ts` |
| Gold ledger report firm balance RPC | Truncated 150-row cache for vault label | `reports.gold-ledger.tsx` |
| KYC PDF images section | Blank PDF — images case was no-op | `print-engine/pdf/generate.ts` |
| worker_kyc visibility flags | Hidden phone/skill in PDF | `print-engine/data-mapper.ts` |

**Verification (pass 4):** `npx tsc --noEmit` PASS · `npm run qa:unit` 106/106 PASS · migration applied via linked query

## Code fixes in this continuation (2026-08-30, pass 5)

| Change | Root cause addressed | File |
|--------|---------------------|------|
| Bank recon CSV import + auto-match | Statement import path was UI-only / missing store wiring | `bank-statement-import.ts`, `bank-reconciliation-store.ts`, `treasury.bank-reconciliation.tsx` |
| Bank charge posting via `postBankChargeVoucher` | `rpc_post_universal_transaction` signature mismatch + wrong Dr/Cr metadata | `money-voucher.ts`, `bank-reconciliation-store.ts` |
| `statement_lines` JSONB column | Persisted imported statement rows | `20260830200000_bank_recon_statement_and_verify_rpcs.sql` |
| Public verify RPCs + registry table | `mint_invoice_verification` signature mismatch on remote; verify rate limits | `20260830200000_bank_recon_statement_and_verify_rpcs.sql` |
| Billing legacy invoice safety tests | null/non-array items/payments crashed print/PDF chain | `billing-query.ts`, `qa/unit/billing-verify-chain.test.ts` |
| Expanded API rate limits | Billing outstanding, cash ledger page, CEO KPIs unprotected | `20260830210000_expand_api_rate_limits.sql` |

**Migration `20260830200000`:** APPLIED — `statement_lines`, `public_document_verifications`, verify/mint RPCs  
**Migration `20260830210000`:** APPLIED — rate limits on billing outstanding, cash ledger page, CEO branch KPIs

**Verification (pass 5):** `npx tsc --noEmit` PASS · `npm run qa:unit` **121/121** PASS · `npm run build` PASS

**Measurement slots still pending:** controlled login `window.__ORNEXA_EGRESS__.loginSummary()` — requires owner browser session; cannot be automated without Playwright/production load.
