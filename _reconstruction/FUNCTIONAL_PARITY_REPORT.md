# Functional A–Z parity report (5190 CVsE73i6 vs editable 5200)

**Date:** 2026-08-29  
**Verdict:** **NOT PASS** — structural/route alignment is strong; **functional backend parity and authenticated E2E are still open.**

| Role | Artifact |
|------|----------|
| 5190 baseline (read-only) | `production-dist-shop/index-CVsE73i6.js` SHA256 `DDE3DCBE…08D8` |
| Editable build (this wave) | `dist/assets/index-DU2ABVHF.js` SHA256 `921DDB01…FE8B7` |
| CURRENT Supabase | `https://dqgrrafuoxaorvyrcuuh.supabase.co` |

---

## Critical fix this wave — data synchronization regression

**Finding:** `src/lib/data-loader.ts` had diverged from the shop-matched extract. It filtered startup pulls with `getActiveBranchId()` + `data->>branchId` JSON paths instead of **`firm_id` column scope** and typed ledger columns.

**Impact (functional, not cosmetic):**
- Wrong/incomplete customer, karigar, stock, order, invoice cache on boot
- Full-table scans → **statement timeouts** (observed: gold_ledger, orders, job_cards, stock_movements, worker_transactions, print_logs)
- Tab counts on People could disagree with list queries when cache vs `people-query` diverged

**Action taken:**
- Replaced `data-loader.ts` with shop-scored extract (`01-online-avs-ornexa`)
- Exported `rowToPerson` from `people-query.ts` (required by restored loader)
- Minimal type casts for `tenant_memberships` / `communication_logs` (schema typings lag RPC tables)

**Evidence:** backup at `_reconstruction/data-loader.ts.src-backup` vs current `src/lib/data-loader.ts`

**Still to verify:** Re-login → confirm background pull completes without timeout; compare People tab counts vs `SELECT count(*)` for firm (needs QA session).

---

## Owner module checklist (5190 shop evidence)

| Module | In CVsE73i6 shop | Editable src | Chain status |
|--------|------------------|--------------|--------------|
| Home / `/app` | Yes (`get_home_dashboard`) | Yes | UI→RPC present; needs auth E2E |
| Master / Group nav folders | Yes (`navigation-*.js` cascade) | Yes (`navigation-groups.ts`) | Folder structure matches extract |
| Folders (nav cascade) | Yes | Yes | Permission-filtered leaves |
| Stamps (print) | Yes (settings stamp images) | Yes | settings → print-engine |
| Staging / warning | Yes (`SourceOfTruthBadge`, partial failure toasts) | Yes | data-loader `runSafe` + error-handling |
| CRM | Yes (`/crm`, communications) | Yes | Route + comm stores |
| Assistant | Yes (`/assistant`, 26 refs) | Yes | UI→assistant libs; edge fn needs auth test |
| CEO | Yes (`CEO (View Only)` role, 6 refs) | Yes | permissions + data-loader global roles |
| Boolean | N/A (JS `Boolean` — **not a product module**) | — | False positive in string audits |
| Schemes | Yes (`/scheme`, 47 refs) | Yes | scheme routes + scheme-store |
| Dice | **No** `/dice` route in shop | **No** route in src | Nothing to restore |
| Wipe | Yes (`utilities.wipeout` → Period Close) | Yes | **Matches shop** — destructive wipe blocked |
| Manufacturing | Yes | Yes | bills, barcode, reconciliation reports |
| Outstanding | Yes | Yes | `get_billing_outstanding_summary`, gold-outstanding report |
| Outside Work | Yes | Yes | jangad, outside-work routes (restored this wave) |
| MTG shell | **No** in shop | Yes | **Gated** `business.mtg_shell` → redirect `/app` if off |
| Catalog masters | **No** in shop | Yes | **Gated** `business.item_masters` → `notFound()` if off |
| Workflows | Yes | Yes | `/workflows` |
| Utilities | Yes (incl. wipeout alias) | Yes | Full utilities tree |

---

## Invented / post-baseline surfaces (not removed — feature-gated)

These exist in editable src but **not** in frozen CVsE73i6 strings. Treated as **newer approved logic**, hidden unless org feature enabled:

1. `/mtg`, `/mtg/` — requires `business.mtg_shell` (redirect to `/app`)
2. `/catalog/masters` — requires `business.item_masters` (`notFound` if off)

No navigation leaf points at `/mtg` in baseline shop chunks.

---

## Full chain audit sample (People / Karigar counts)

| Layer | Implementation | Shop-aligned? |
|-------|----------------|---------------|
| UI | `people.index.tsx` tabs | Yes |
| State | `fetchPeoplePage`, `fetchPeopleTabCounts` | Yes (extract-matched) |
| Query | `people-query.ts` — Supabase `people` table, `count: exact` | Yes |
| Boot cache | `pullPeople` — `.eq("firm_id", firmId)`, `rowToPerson` | **Fixed this wave** |
| RLS | Tenant scope via auth (401 on anon RPC probes) | Present |
| Ledger | Separate gold_ledger firm-scoped pull | **Fixed this wave** |

**Known risk:** `fetchPeopleTabCounts` filters optional `branchId` only — firm scope relies on RLS (same as shop extract). Authenticated count parity test still required.

---

## Route / module inventory

- **294** route files in `src/routes`
- **681** shop chunk basenames; **0** business modules truly missing (rename/vendor noise only)
- **47-path HTTP smoke × 3 rounds:** 0 failures (`_reconstruction/smoke-az-local.json`)
- **Named RPC probes × 3:** all critical RPCs OK/PRESENT, `missingUnique: []` (`_reconstruction/supabase-rpc-probe-named.json`)

---

## Remaining discrepancies (evidence — blockers for PASS)

### P0 — Authenticated functional E2E
- Playwright requires `E2E_EMAIL` / `E2E_PASSWORD` on **CURRENT** project
- No `.env.e2e` configured; staging creds in `memory/test_credentials.md` must **not** be used
- **Required:** login → vault issue → billing → verify QR → ledger pages → print PDF → portal KYC → mobile 5-tab × **2–3 runs**

### P0 — Post-fix data-loader verification
- Re-test after `firm_id` restore: background pull must not log statement timeouts
- Compare People karigar/customer tab counts vs DB for one firm (owner-reported historical mismatch case)

### P1 — Symbol count skew (needs behavioural proof)
- `requireVaultStockLine`, `ensureInvoiceVerification` — string count DIFF; functions exist in both builds

### P1 — Navigation leaf diff
- Manual spot-check: src `navigation-groups.ts` matches extract (same file lineage); automated leaf diff script pending cleanup

### P2 — Rebuild hash ≠ shop hash
- Expected for source rebuild; not a functional failure by itself

---

## Recovery rule compliance

| Source | Used? | Provenance |
|--------|-------|------------|
| `production-dist-shop/` (5190) | Read-only oracle | SHA256 verified |
| `AVS-FULL-SOURCE-EXTRACT/01-online-avs-ornexa` | Yes — data-loader, workshop routes, report libs | Shop chunk symbol match |
| Hostinger live site | **Not used this wave** | Available if gap found with hash check |
| Messenger MCP | **Not used this wave** | — |
| Older backups / staging DB | **Not used** | — |

---

## Next steps (before any ₹10K/₹20K/MTJ work)

1. Owner provides QA credentials → `.env.e2e` for `dqgrrafuoxaorvyrcuuh`
2. Run full `e2e/` suite 2–3×; file failures with route + screenshot + DB query
3. Confirm data-loader clean boot (no timeout errors in console)
4. Sign-off checklist in `_reconstruction/ALIGNMENT_PROGRESS.md`

**Functional parity PASS cannot be declared until P0 items close with evidence.**
