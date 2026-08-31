# P0 Performance + Loading + Error Recovery Audit

**Date:** 2026-08-16  
**Environment:** TEST/STAGING (`https://avs-erp-preview-20260806.hostingersite.com`)  
**Build:** post `resilient-async` + staged loading pass

---

## Executive summary

| Finding | Root cause | Fix |
|---|---|---|
| ERR-* toast storms during boot | Every background Supabase pull called `reportUnexpectedError` → user toast | `logBackgroundError()` — logs only, no toast for hydration |
| Spurious `Connection problem` ERR refs | Debug agent POST to `127.0.0.1:7392` on every error (staging cannot reach) | Removed debug ingest from `error-handling.ts` |
| Slow / stuck boot on branch settings | Sequential `provider_secret_is_configured` RPC per branch | Parallel `Promise.all` |
| Critical load could hang indefinitely | No timeout on `pullCritical` | 45s timeout + 2-attempt retry with backoff |
| Shell blocked by 1.8s fake “done” | `markInitialLoadDone()` safety valve masked failures | Replaced with staged phases + `criticalLoadFailed` recoverable state |
| Dashboard infinite skeleton | No timeout on `get_home_dashboard_summary` RPC | 45s timeout + retry; staged slow/retry UI |
| Generic amber error strip | No recoverable actions | `StagedLoadPanel` with Retry / Go Home / Report Issue |
| One widget crash kills home | No widget boundary | `WidgetErrorBoundary` on dashboard sections |

---

## Staged loading contract (implemented)

| Elapsed | UX |
|---|---|
| 0–10s | Skeleton / progressive UI (shell visible) |
| 10–20s | “Connection is taking longer than usual…” |
| 20–45s | “Still trying to connect” + **Retry** |
| >45s or hard failure | Stop spinner → recoverable error + Retry / Go Home / Report Issue |

**Files:** `resilient-async.ts`, `use-staged-load.ts`, `staged-load-panel.tsx`, `boot-progress-shell.tsx`

---

## Boot architecture (after fix)

```
Auth session restore (≤12s) → BootProgressShell (staged messages)
  → startCloudSync()
      → pullCritical() [45s timeout, retry×2] → markCriticalLoadDone OR criticalLoadFailed
      → pullBackground() [parallel, non-blocking, errors logged only]
  → App shell renders immediately (sidebar/header)
      → Route content + optional overlay until critical done
      → Dashboard fetch independent with own timeout
```

**Heavy modules NOT on critical path:** reports, portals, Assistant, PDF engine, full ledger history, comm schedulers (background only).

---

## Route-by-route status

| Route / area | Startup dependency | Failure mode (before) | After fix |
|---|---|---|---|
| `/` Home dashboard | `pullCritical` + RPC `get_home_dashboard_summary` | Skeleton forever / amber text | Staged panel + widget boundary |
| `/orders/*` | Background `pullOrders` | Toast per ERR | Silent log; route query on demand |
| `/stock/*` | Background `pullInventory` | Toast storm | Silent log; paginated queries |
| `/ledger` | On-demand + tail cache | Export TS errors (fixed prior) | Loads independently |
| `/billing/*` | Background invoices | Secondary toast | Silent log |
| `/platform/*` | Auth + platform RPCs | Search param TS errors (fixed prior) | Shell-first |
| `/customer-portal` | Portal auth path | Type errors (fixed prior) | Bypasses tenant gate |
| `/settings/*` | `pullCritical` settings | Blocked on full pullAll | Critical-only gate |
| Communications | `bootCommunicationRuntime` | Edge scheduler errors toasted | `console.warn` only |
| Assistant drawer | Lazy import | Preloaded with shell | Still lazy (no boot block) |

---

## ERR-* reference tracing

`ERR-YYYYMMDD-XXXXXXXX` IDs are generated in `normalizeError()` (`error-handling.ts`).

| Category | Typical technical message | User action |
|---|---|---|
| `network` | fetch failed / timeout | Retry after 10–20s panel |
| `database` | Supabase RLS / migration | Report Issue with reference ID |
| `authentication` | session / role | Re-login |
| `data-loader.*` | table pull failure | Background: logged only; critical: boot panel |

**Session log:** `sessionStorage` key `mtj_erp_error_log` (last 50 errors).

---

## Verification run

| Check | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run build` | PASS |
| `get_home_dashboard_summary` on staging | EXISTS |
| `provider_secret_is_configured` on staging | EXISTS |

---

## Remaining EXTERNAL (not infinite spinner)

- Supabase project cold start / network latency on mobile — mitigated by staged UX, not eliminable
- Missing third-party credentials (SMTP, WhatsApp, Razorpay) — configuration errors, not boot blockers
- Playwright route sweep — recommended for QA tomorrow with network throttling

---

## QA test script (recommended)

1. Throttle network to **Slow 3G** → login → confirm shell <3s, staged messages at 10s/20s
2. Offline → login → confirm recoverable error ≤45s with Retry
3. Home dashboard → confirm widgets load progressively; one failed RPC does not white-screen
4. Open Orders + Stock — confirm usable while background hydration continues
5. Copy ERR reference from panel → verify entry in browser console + support flow
