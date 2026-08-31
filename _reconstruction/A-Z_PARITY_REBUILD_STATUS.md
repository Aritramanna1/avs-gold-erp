# A–Z Parity Rebuild — Status (2026-08-30)

**Reference:** Ma Tara Jewellers frozen shop (`production-dist-shop/`, `index-CVsE73i6.js`, git `8dc1c43`)  
**Editable target:** `src/` → Aurum deploy  
**Verdict:** **NOT PASS** — parity rebuild in progress; no completion claim.

---

## Order of work (owner mandate)

| # | Workstream | Status | Notes |
|---|------------|--------|-------|
| 1 | Full Ma Tara A–Z parity audit | **IN PROGRESS** | See module matrix below |
| 2 | Dashboard / data loading | **PARTIAL** | RPC + people counts verified (27 customers, 50 karigars QA firm) |
| 3 | Customer / karigar completeness | **PARTIAL** | Firm-scoped queries; deterministic probe PASS |
| 4 | Master / opening / ready stock | **IN PROGRESS** | ItemMasterPicker fix; stock import; `item_master_id` migration |
| 5 | Central automatic calculations | **IN PROGRESS** | `transaction-calculations.ts`; settlement + orders routed |
| 6 | Gold / purity / gold+cash flows | **IN PROGRESS** | Settlement gold exchange via `calculateGoldValuePaise` |
| 7 | Item Master / Item Group | **IN PROGRESS** | `item_groups` table + CRUD UI; catalog masters group picker |
| 8 | Backend API/RPC/RLS wiring | **PARTIAL** | RPC 25006 fixed; stock `firm_id`; migration pending apply |
| 9 | Error sweep | **IN PROGRESS** | Build/typecheck green |
| 10 | Performance | **PARTIAL** | 35/35 perf script; client bundle `index-BqOvri0o.js` |
| 11 | Reports / print / PDF | **NOT STARTED** | |
| 12 | Enhancement / MTG work | **BLOCKED** until parity PASS | |

---

## Module parity matrix (honest)

Legend: ✅ verified match · 🟡 partial / structural only · 🔴 broken or untested · ⬜ not audited this wave

| Module | Route/nav vs shop | Data loads | Workflow | Calc | Backend | Verdict |
|--------|-------------------|------------|----------|------|---------|---------|
| PUBLIC WEBSITE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| AUTH | 🟡 | 🟡 | 🟡 | — | 🟡 | NOT PASS |
| DASHBOARD | 🟡 | 🔴→🟡 | 🟡 | 🟡 | 🟡 | NOT PASS |
| NAVIGATION | ✅ | — | — | — | — | structural OK |
| MASTER / People | 🟡 | 🔴→🟡 | 🟡 | — | 🔴→🟡 | NOT PASS |
| TRANSACTION | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| PAYROLL | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| BARCODE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| REPORTS | ⬜ | 🔴→🟡 | ⬜ | ⬜ | 🟡 | NOT PASS |
| PRODUCTION | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| GST / ESTIMATE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| SCHEME / BULLION | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| CUSTOMERS | 🟡 | 🔴→🟡 | 🟡 | — | 🔴→🟡 | NOT PASS |
| KARIGARS | 🟡 | 🔴→🟡 | 🟡 | — | 🔴→🟡 | NOT PASS |
| STOCK / ITEM MASTER | 🟡 | 🟡 | 🟡 | 🟡 | 🟡 | NOT PASS |
| BILLING / GOLD / VAULT | ⬜ | ⬜ | 🔴 | 🔴 | ⬜ | NOT PASS |
| PORTALS | 🟡 | 🟡 | 🟡 | — | 🟡 | NOT PASS |
| SETTINGS / PRINT / PDF | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |

Prior audits: `_reconstruction/FUNCTIONAL_PARITY_REPORT.md`, `_reconstruction/MASTER_GAP_REGISTER.md`

---

## Data-layer fixes (this session)

| Fix | File | Root cause addressed |
|-----|------|---------------------|
| Explicit `firm_id` on people list/count | `people-query.ts` | RLS-only vs client firm resolution mismatch |
| Type filter column + jsonb `data.type` | `people-query.ts` | Legacy rows invisible on Customers/Karigars tabs |
| Store refresh firm-scoped + `rowToPerson` | `people-store.ts` | Unscoped refresh overwrote boot cache |
| List + tab counts refetch on save | `people.index.tsx` | New party not appearing until navigation |
| Branch filter MAIN race | `people.index.tsx` | Branch staff saw empty lists before branch remap |
| Dashboard bucket firm required | `home-dashboard-query.ts` | Unscoped bucket fetch when firm null |
| Dashboard people firm-scoped | `home-dashboard-query.ts` | Missing names on order reminders |
| Fallback gold KPIs via balance RPC | `home-dashboard-query.ts` | Summing 120 ledger rows → wrong counts |
| Today invoice count via COUNT query | `home-dashboard-query.ts` | Fallback under-count |
| `pullPeople` dedupe | `data-loader.ts` | Duplicate boot + realtime pulls |
| STABLE RPC rate limit 25006 | migration `20260830270000` | Gold ledger + reports HTTP 405 |
| Item groups DB + inventory master link | migration `20260830280000` | Free-text groups; no item authority on stock |
| Central calc orchestrator | `transaction-calculations.ts` | Duplicate `fineGoldMg` at settlement/orders |
| Settlement gold+cash at txn rate | `settlement.$id.tsx` | Manual rate math bypassing engine |

---

## Verification commands (no Playwright)

```bash
npm run typecheck
npm run build
npm run qa:unit
node scripts/verify-performance-final.mjs
node scripts/verify-build-client-fixes.mjs
node scripts/verify-dashboard-people.mjs
```

Evidence artifacts: `_reconstruction/PERFORMANCE_VERIFICATION_FINAL.json`, `BUILD_CLIENT_FIXES_VERIFICATION.json`, `DASHBOARD_PEOPLE_VERIFICATION.json`

**Migration apply:** `20260830280000_item_groups_and_inventory_master_link.sql` is in repo; Supabase CLI not available in agent shell — owner must apply before Item Groups UI writes succeed in production.

```bash
node scripts/verify-auth-final.mjs   # needs SUPABASE_SERVICE_ROLE_KEY
```

Manual: login → `/app` dashboard → `/people?tab=customers` → `/people?tab=karigars` — confirm counts match Supabase for active firm.

---

## Explicit non-claims

- Routes existing ≠ parity PASS  
- Build/typecheck PASS ≠ parity PASS  
- UI similarity ≠ parity PASS  
- Partial module fix ≠ A–Z complete  

**Next tranche:** stock/master/opening-ready flows audit against shop chunks, then centralized calculation engine.
