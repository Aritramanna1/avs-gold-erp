# Alignment progress — A–Z wave (2026-08-29 late) — NOT FULL PARITY PASS

## Priority lock (owner mandate)

1. **Full A–Z parity** vs CVsE73i6 + CURRENT Supabase (`dqgrrafuoxaorvyrcuuh`): public site, ERP, portals, **mobile**, auth/OAuth, routes, modules, gold/vault, ledgers, billing, stock, mfg, reports, settings, docs/print/PDF/QR, KYC, RLS/RPC, storage, notifications.  
2. ₹10K / ₹20K / MTJ / NN202000 / new calcs — **forbidden** until parity verified.  
3. **Do not** declare PASS from build/typecheck/string checks alone.

## Running now

- **Dev server:** http://localhost:3000/ (`npm run dev`, `.env.local` → `https://dqgrrafuoxaorvyrcuuh.supabase.co`)
- Shop oracle (untouched): `production-dist-shop/` / `index-CVsE73i6.js`

## Build / hash / baseline identity

| Artifact | Value |
|----------|--------|
| Editable build index | `dist/assets/index-DU2ABVHF.js` |
| Editable build SHA256 | `921DDB0104C3086C4CAF01C85EE4B9F99B846C1B073AC84F34C55AAAB5BFE8B7` |
| Frozen shop index | `index-CVsE73i6.js` |
| Frozen shop SHA256 | `DDE3DCBECA50D0EE30882C0B98B25D8E95E8B1429319EFBD31720C61518D08D8` (**untouched**) |
| Baseline git equation (manifest) | `8dc1c438214a5e3192e15dc95b7708de24ca6baf` |
| This handoff folder git HEAD | **none** (standalone package, no `.git`) |
| Typecheck | `tsc --noEmit` **pass** (0 errors) |
| `npm run build` | **pass** |

## Structural inventory (shop assets vs `src/`)

| Metric | Value |
|--------|--------|
| Shop unique chunk basenames | 681 |
| `src` `.ts/.tsx` files | 1155 |
| Unmatched basenames | 68 (all rename or vendor/lucide noise) |
| Business unmatched | 11 — **0 truly missing** (`doc.$token`, `unsubscribe.$token`, `legal/$slug`, `blog/$slug`, Capgo twitter-provider, lucide icons) |

### Workshop routes restored this wave (were in shop + extract, missing from `src/routes`)

- `/transactions` → `transactions.tsx`
- `/workshop/dhadi-groups`
- `/workshop/jangad`
- `/workshop/karigar-book` (+ `karigar-book-query.ts`)
- `/workshop/vibrator`

Nav already pointed at these paths (`navigation-groups.ts` / offline catalog).

### Other lifts this wave (shop-matched extract)

- Report query libs: `stock-books-query`, `gold-loss-report-query`, `reconciliation/balance-reconciliation`
- Full `report-engine.triggerPrint` (PDF → print engine) + `print-engine/comm-print-resolver`, `pdf/catalog`
- `bwip-js` + browser type shim
- Comm `linkedType` widened for challan / credit / debit / gold_settlement / portal_invitation

## Symbol parity (`_reconstruction/symbol-parity.mjs`)

| Symbol | shop | dist | |
|--------|------|------|---|
| assertVaultGoldIssueAvailable | 13 | 13 | OK |
| assertTransactionGoldIssueFromLedger | 12 | 12 | OK |
| assertMaterialIssueStock | 4 | 4 | OK |
| mint_invoice_verification | 2 | 2 | OK |
| verify_public_document | 1 | 1 | OK |
| register_document_verification | 2 | 2 | OK |
| get_gold_ledger_page | 1 | 1 | OK |
| get_company_cash_ledger_page | 2 | 2 | OK |
| rpc_post_universal_transaction | 1 | 1 | OK |
| requireVaultStockLine | 5 | 3 | DIFF (pref key vs fn naming) |
| ensureInvoiceVerification | 4 | 5 | DIFF (close) |

## Live Supabase named-arg probes — 3 rounds (`probe-supabase-rpcs-named.mjs`)

Target: `https://dqgrrafuoxaorvyrcuuh.supabase.co`  
Evidence: `_reconstruction/supabase-rpc-probe-named.json`

| RPC | Result (anon) |
|-----|----------------|
| verify_public_document | 200 OK (invalid token — expected) |
| get_public_website_bundle | 200 OK |
| get_platform_trial_days | 200 OK (=7) |
| mint_invoice_verification | 401 PRESENT |
| get_gold_ledger_page | 401 PRESENT |
| get_company_cash_ledger_page | 401 PRESENT |
| get_my_memberships | 401 PRESENT |
| set_active_tenant_context | 401 PRESENT |
| get_my_portal_context | 401 PRESENT |
| get_authorization_context | 401 PRESENT |
| next_document_number | 401 PRESENT |
| post_metal_conversion | 401 PRESENT |
| customer_portal_approve_design | 401 PRESENT |
| supplier_portal_accept_purchase | 401 PRESENT |
| rpc_post_universal_transaction | 401 PRESENT |
| register_document_verification | 401 PRESENT |

**missingUnique: []** across 3 rounds (empty `{}` probes previously false-flagged PGRST202 as MISSING).

## HTTP smoke localhost:3000 — 3 rounds × 47 paths — 0 failures

Evidence: `_reconstruction/smoke-az-local.json` / `smoke-az.log`  
Includes public marketing, legal, verify/doc/unsubscribe tokens, ERP shell, workshop extras, reports, portals, **mobile** routes — all **200**.

## Remaining gaps (evidence) — parity NOT PASS

1. **Authenticated E2E golden path — PASS (2026-08-29)**  
   - `.env.e2e` → QA firm owner on `dqgrrafuoxaorvyrcuuh`  
   - `npx playwright test e2e/tests/parity-golden-path.spec.ts --repeat-each=2` → **28/28 pass**  
   - Full `e2e/` suite + deep flows (billing→print/PDF, vault issue, portal KYC) still open.

2. **Authenticated business flows not fully exercised** (login → vault issue → billing → ledger RPC pages → print/PDF → portal KYC → OAuth). Golden path covers shell + people counts + route loads only.

3. **Data-loader / counts — improved**  
   - `auth-data-parity.mjs` ×3 stable: customers 27, karigars 59, people 88, orders 353, etc.  
   - Full-table `gold_ledger` COUNT still times out (57014); paginated RPC OK.  
   - `data-loader.ts` restored to `firm_id` scoping (not JSON branchId).

4. **Symbol DIFF** remain: `requireVaultStockLine`, `ensureInvoiceVerification` count skew (needs behavioural compare, not string equality).

5. **OpenAPI full RPC inventory** still needs service-role (anon cannot list); named probes used instead.

6. **Rebuild hash ≠ shop hash** by design (source rebuild).

7. **Src-only extras** present: `mtg.tsx` / `mtg.index.tsx`, `catalog.masters.tsx` — leave alone; **do not** implement new ₹10K/₹20K/MTJ requirements on them until parity PASS.

## UI parity wave (2026-08-29 evening)

- Restored full **`src/i18n/{en,hi,mr,bn}/navigation.ts`** from shop-matched extract (~240 keys). Truncated copy (~27 keys) caused raw fallback labels in sidebar.
- **Removed `StagingEnvironmentBadge`** from `src/routes/__root.tsx` (5190 shop has no amber staging banner).
- Browser verify on localhost: sidebar groups **HOME, MASTER, TRANSACTION, UTILITY, REPORTS**, … — no “Grouped” suffix labels.
- Restored full **Bank Reconciliation** (`bank-reconciliation-store.ts` + `treasury.bank-reconciliation.tsx`) with voucher clearing, computed book balance, bank charges.

## Owner verification checklist (still open)

- [x] E2E creds for CURRENT project → golden path **2× pass**  
- [ ] Sign-in → vault gold issue blocked when insufficient  
- [ ] Billing create → verification QR / `/verify`  
- [ ] Ledger cash + gold pages via RPC  
- [ ] Portal KYC upload  
- [ ] Print/PDF one invoice  
- [ ] Mobile 5-tab chrome + work/business/reports/more on phone viewport  
- [ ] Google OAuth / native social login path  
- [ ] Confirm data-loader timeout behaviour vs shop  

**Verdict: structural + route + anon RPC surface largely aligned; full application parity NOT declared.** No ₹10K/₹20K/MTJ work until authenticated E2E closes the gaps above.

---

## Functional parity wave (2026-08-29 late)

See **`_reconstruction/FUNCTIONAL_PARITY_REPORT.md`** for full module checklist and chain audit.

### Critical backend fix
- Restored shop-matched **`data-loader.ts`** (`firm_id` scoping + typed ledger columns). Previous editable copy used `data->>branchId` JSON filters → wrong counts + statement timeouts.
- Backup: `_reconstruction/data-loader.ts.src-backup`

### Post-baseline features gated (not in CVsE73i6 shop)
- `/mtg` → `business.mtg_shell` (redirect `/app` if off)
- `/catalog/masters` → `business.item_masters` (already gated)

### Module notes
- **Dice** — no product module in shop or src
- **Boolean** — JS helper, not a module
- **Wipe** — shop-aligned “Period Close (not Wipeout)” alias page
- **CEO** — `CEO (View Only)` role present in shop + permissions
