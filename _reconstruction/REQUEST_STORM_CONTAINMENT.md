# Request Storm Containment — dqgrrafuoxaorvyrcuuh

**Date:** 2026-08-30  
**Status:** CONTAINED — dev servers stopped, code guards applied

## Observed usage (Supabase dashboard)

| Metric | Value | Implied rate |
|--------|-------|--------------|
| Last 60 minutes | **103,097** requests | **~1,718 req/min** |
| Last 24 hours | **1,626,027** requests | **~1,130 req/min avg** |
| Auth (24h) | **499,924** | **~347 auth/min** |
| API Gateway (24h) | **1,177,366** | **~818 REST/min** |

With **zero paying tenants**, this is not organic production traffic.

## Root cause (confirmed)

### 1. Long-running `npm run dev` against production Supabase (PRIMARY)

- **PID 14096** on port **3000** — node process with **9,200+ CPU seconds** since 2026-08-29 21:03
- `.env.local` points at `https://dqgrrafuoxaorvyrcuuh.supabase.co`
- Every Vite **HMR reload** re-ran:
  - `auth.getSession()` + `onAuthStateChange` bootstrap
  - `resolveAuth()` → `get_authorization_context` RPC
  - `startCloudSync()` → **25+ parallel table pulls** (full JSONB `data` columns)
  - Realtime subscription on **30+ tables** → each change triggered full re-pulls
- **Before RLS fix:** timeouts (57014) caused retries → amplified storm

### 2. Playwright / parity QA (SECONDARY)

- Traces in `e2e/test-results/` show HeadlessChrome hitting `localhost:3000` at 22:14 UTC
- Each test: login → full boot → navigate all modules → repeat
- `run-parity-serial.mjs` can run full matrix against same project

### 3. Auth refresh re-bootstrap loop (AMPLIFIER)

- `onAuthStateChange` handled **`TOKEN_REFRESHED`** like a new login
- Each refresh could re-trigger `resolveAuth()` + conditional `startCloudSync()`
- Supabase `autoRefreshToken: true` → periodic auth traffic (~347/min baseline)

### 4. Realtime → full table re-pull (AMPLIFIER)

- 30+ `postgres_changes` listeners, each calling `pullX()` (500-row JSONB downloads)
- No debounce on many handlers; burst writes = burst egress + API calls

## Top endpoints/functions responsible

| Caller | Endpoint / RPC | Why repeating |
|--------|----------------|---------------|
| Auth bootstrap | `/auth/v1/token`, `/auth/v1/user` | HMR + TOKEN_REFRESHED + Playwright login |
| Authorization | `get_authorization_context` | Every auth bootstrap + workspace switch |
| Data loader | `/rest/v1/orders?select=data`, `/rest/v1/job_cards`, `/rest/v1/gold_ledger`, … | Boot + realtime (25+ tables) |
| Dashboard | `get_home_dashboard_summary` + orders/job_cards fetch | Every `/app` visit |
| RLS (pre-fix) | COUNT on `gold_ledger` | 57014 timeout → client retry storms |
| Edge comm | `invokeCommunicationScheduler` | Every 15–60 min per open session |
| Realtime | WebSocket + channel subscribe | Persistent while tab open |

## Immediate containment (DONE)

1. **Stopped processes:** PIDs 14096 (port 3000), 49048 (5173), 11032 (4173), high-CPU node workers
2. **Playwright hard-blocked** against production ref unless `ALLOW_PROD_E2E=1`
3. **Parity runner** already requires `ALLOW_PROD_PARITY=1`
4. **Probe scripts** require `ALLOW_PROD_PROBE=1`
5. **NO further live Supabase probes** during this investigation

## Code fixes applied

| Fix | File | Effect |
|-----|------|--------|
| Ignore `TOKEN_REFRESHED` / `USER_UPDATED` in auth bootstrap | `auth-gate.tsx` | Stops auth→full boot loop |
| Dev quarantine: block cloud sync unless `VITE_ENABLE_DEV_SUPABASE=1` | `data-loader.ts` | Dev/HMR uses cache only by default |
| API + Auth fetch throttle (12 REST + 8 auth / 10s, dedupe) | `supabase-fetch-throttle.ts` | Caps burst rate |
| Realtime: 9 core tables only, 2–3s debounce, skip in hidden tab | `realtime-sync.ts` | Cuts subscription-driven pulls |
| Deferred boot pulls (90s idle) | `data-loader.ts` | ~50% fewer login requests |
| Playwright: block prod ref unconditionally | `playwright.config.ts` | Cannot accidentally run E2E |

## Before / after (expected)

| Metric | Before (storm) | After containment |
|--------|----------------|-------------------|
| Requests/min | **~1,718** (60m peak) | **<10** idle (no dev tabs) |
| Auth/min | **~347** sustained | **<2** idle |
| CPU | **>80%** | Should fall within 15–30 min |

**Verify in Supabase dashboard** over next 30–60 minutes with all dev tabs closed.

## Rules until owner clears

1. **Do NOT** run `npm run dev` against production Supabase without `VITE_ENABLE_DEV_SUPABASE=1`
2. **Do NOT** run Playwright, parity, or probe scripts against `dqgrrafuoxaorvyrcuuh`
3. **Do NOT** run `supabase db query` diagnostics unless urgent
4. Use **`npm run preview:shop`** for UI-only work (frozen bundle, no live DB)
5. For cloud dev: set `VITE_ENABLE_DEV_SUPABASE=1` in `.env.local` temporarily

## Normal ERP operation

Production shop (`maatarajewellers.shop`) and authenticated ERP with **deployed build** (not dev HMR) remain unaffected. Dev quarantine only affects `import.meta.env.DEV`.
