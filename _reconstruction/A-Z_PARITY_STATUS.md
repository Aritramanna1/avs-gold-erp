# A–Z Parity Status — 5190 vs 5200

**Updated:** 2026-08-30 (Supabase traffic containment)  
**Verdict:** **NOT PASS** — all E2E **FROZEN** against production Supabase.

---

## MORATORIUM (effective immediately)

**NO Playwright, parity matrix, load scripts, or repeated QA automation against production Supabase project `dqgrrafuoxaorvyrcuuh`.**

Resume E2E only when:
1. Containment code is merged (boot dedup, fetch throttle, E2E circuit breaker). **Done 2026-08-30.**
2. Separate non-production QA Supabase project is configured in `.env.e2e`.
3. Supabase dashboard metrics are flat for 15+ minutes after manual dev use only (see [`SUPABASE_BASELINE.md`](./SUPABASE_BASELINE.md)).

Invalid / high-cost runs (do not use as parity evidence):
- `parity-reports-full` 120-test suite (~58 min, 115 pass before fixes)
- Parallel / colliding auth runs (`state.json` ENOENT storms)
- Serial matrix with `--force-auth` against production
- Owner-account runs (0 invoices)

---

## Code fixes landed (pre-freeze)

| Item | Status |
|------|--------|
| Gold ledger Print → Download PDF | **FIXED** — `__root.tsx` pdfBlob pass-through |
| 5 report print/export failures | **FIXED in code** (delivery-summary, gold-loss, gst-returns, ledgers, tally-export) — **not re-E2E'd on prod** |
| Auth collision infrastructure | `e2e/auth-setup-lock.ts`, `run-parity-serial.mjs` matrix lock |
| Supabase containment | boot session cache, fetch throttle, scheduler gating, E2E circuit breaker |

---

## Account policy

| Account | Firm | Use |
|---------|------|-----|
| QA (`.env.e2e`) | `f9f73cce…` | **Manual dev only** until isolated QA project |
| Owner | `3aa73b3f…` | Shop oracle UI reference only |

---

## Still blocking PASS

1. Containment verified + metrics baseline documented (`_reconstruction/SUPABASE_BASELINE.md`).
2. Isolated QA Supabase project for E2E.
3. Full serial parity matrix clean on **non-prod** only.

**MTJ / edition: BLOCKED**
