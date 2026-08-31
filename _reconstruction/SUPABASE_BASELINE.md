# Supabase Traffic Baseline — Post-Containment

**Project:** `dqgrrafuoxaorvyrcuuh` (production)  
**Captured:** 2026-08-30 ~03:45 IST (after Playwright/parity stop)  
**Purpose:** Establish a flat-traffic baseline before any E2E resume discussion.

---

## Phase 0 actions taken

- All `npx playwright test`, `run-parity-serial.mjs`, and parity automation **stopped**.
- E2E **FROZEN** — see [`A-Z_PARITY_STATUS.md`](./A-Z_PARITY_STATUS.md).
- Dev server may remain on `http://localhost:3000` for **manual UI only** (one tab; avoid Retry banner).

---

## Dashboard checklist (owner — read-only)

Open [Supabase Dashboard](https://supabase.com/dashboard/project/dqgrrafuoxaorvyrcuuh) → **Reports** / **Database** / **Auth**:

| Metric | Post-stop expectation | Notes |
|--------|----------------------|-------|
| **API requests** | Flat or near-zero after ~5 min idle | Spike should end when Playwright killed |
| **Auth requests** | Occasional token refresh only | No global-setup login storms |
| **Postgres queries** | Low steady state | No 25× parallel boot pulls |
| **Realtime connections** | 0–1 (manual dev tab) | No concurrent Playwright contexts |
| **Egress** | Minimal JSON | No 500-row invoice/ledger stampede |

Record screenshots with timestamps here or in owner notes:

- [ ] API requests graph (15 min window after stop)
- [ ] Auth requests graph
- [ ] Postgres / Database health
- [ ] Egress (if visible on plan)

---

## Pre-spike context (for correlation)

| Window | Driver |
|--------|--------|
| ~02:00–03:30 IST | `parity-reports-full` (~120 tests), serial matrix, global-setup re-auth |
| Each `page.goto` | Full SPA reload → `startCloudSync()` → ~25 background table pulls |
| Production URL | `.env.local` + `.env.e2e` both pointed at `dqgrrafuoxaorvyrcuuh` |

---

## Containment shipped (application)

| Control | Location |
|---------|----------|
| E2E boot block | `VITE_DISABLE_PARITY_BOOT=1` in Playwright webServer; `startCloudSync` early return |
| Prod URL gate | `playwright.config.ts`, `run-parity-serial.mjs` refuse `dqgrrafuoxaorvyrcuuh` |
| Boot session dedup | `src/lib/boot-session-cache.ts` + `data-loader.ts` (30 min TTL) |
| Retry debounce | `app-shell.tsx` — 60s between full sync retries |
| Fetch throttle | `src/lib/supabase-fetch-throttle.ts` → Supabase client (30 req/10s, GET coalesce) |
| Dev scheduler quiet | `boot-communication.ts` (5 min intervals), realtime invoice skip in DEV, bullion gated |

---

## Manual verification protocol (15 min)

1. Ensure **no** Playwright/parity processes running.
2. Open **one** browser tab → `http://localhost:3000`, log in once.
3. Navigate 5 routes (e.g. Dashboard, Billing, Reports/GST, Gold Ledger, Settings).
4. **Do not** click Retry on degraded boot banner.
5. Watch Supabase metrics for **15 minutes** — should stay flat.
6. Reload once — second load should hit session boot cache (fewer REST calls).

Pass criteria: no sustained API cliff; Auth spikes only on single login.

---

## Agent verification (2026-08-30 ~03:50 IST)

- No Playwright/parity node processes detected after stop.
- `run-parity-serial.mjs` **exits 1** when `.env.e2e` targets production ref (gate works).
- `npm run typecheck` **passes** after containment changes.
- Dev server smoke (HTTP only, unauthenticated): `/`, `/billing`, `/settings`, `/reports/gst-returns` → **200**; `/reports/gold-ledger` slow compile (timeout at 10s — retry manually in browser).

**Owner action:** Complete 15-minute Supabase dashboard watch per protocol above before any E2E resume.

---

## Resume E2E only when

1. Baseline flat for 15+ min (manual dev only).
2. Separate **non-production** QA Supabase project in `.env.e2e`.
3. Owner approves small smoke (≤14 golden-path tests) on QA project first.
