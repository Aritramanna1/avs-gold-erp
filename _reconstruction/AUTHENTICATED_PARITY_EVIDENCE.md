# Authenticated parity verification — 2026-08-29

**Verdict: NOT PASS** (golden path E2E improved; full billing/print/portal/KYC chains still open)

## QA account (CURRENT Supabase only)

- Project: `dqgrrafuoxaorvyrcuuh`
- Account: `mtj.qa.firm-owner.20260731@example.com` (from extract `.env.e2e`, owner-directed live QA)
- Firm ID: `f9f73cce-9538-4286-9754-530ca4581fbb`
- Local target: `http://localhost:3000` (5200 editable)

## Authenticated REST counts × 3 rounds — STABLE

Evidence: `_reconstruction/auth-data-parity.json`

| Entity | Count (firm-scoped) |
|--------|---------------------|
| customers | 27 |
| karigars | 59 |
| people (total) | 88 |
| orders | 349 |
| job_cards | 343 |
| inventory | 352 |
| invoices | 387 |
| stock_movements | 680 |
| gold_ledger RPC | 200 OK (paginated; full-table COUNT times out — DB perf, not mock data) |
| dashboard RPC | 200 OK |

## Playwright golden path (`parity-golden-path.spec.ts`)

| Round | Result |
|-------|--------|
| 1 (retest) | 14/14 pass |
| 2 | 14/14 pass |
| 3 | 14/14 pass |

Includes: login session, `/app` data load (no pull timeout console errors), people tab counts, core routes, mobile `/mobile/work`.

**Fix applied:** `e2e/global-setup.ts` → `/login` (dev marketing `/` does not host auth form).

## Remaining gaps before PARITY PASS

1. **5190 vs 5200 side-by-side UI count compare** on same session (shop preview port vs localhost) — not run (shop preview conflicts port 3000).
2. **Deep chains:** billing create → verify QR → print/PDF; portal KYC upload; vault issue block — not in golden spec yet.
3. **gold_ledger** full-table COUNT timeout on large firm (Postgres 57014) — startup uses firm-scoped LIMIT 250 (shop-aligned); monitor in prod.
4. **OAuth / Google native** path not E2E-tested.

## Code changes this wave

- `.env.e2e` (gitignored) for CURRENT QA account on localhost
- `_reconstruction/auth-data-parity.mjs` — authenticated count probe
- `e2e/tests/parity-golden-path.spec.ts` — golden path suite
- `e2e/global-setup.ts` — navigate to `/login`
