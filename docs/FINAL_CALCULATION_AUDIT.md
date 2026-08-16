# FINAL CALCULATION AUDIT — Gold & Accounting

**Date:** 2026-08-16

---

## Gold (integer milligrams, per-mille purity)

| Rule | Implementation | Tests | Status |
|------|----------------|-------|--------|
| Fine weight from gross × purity | `calculation-engine.ts` | `gold.calculations.test.ts` (13) | **READY_FOR_QA** |
| Karigar wastage with runtime rules | `calculateKarigarWastageWithRuntimeRules` | formula-engine (6) | **READY_FOR_QA** |
| Gold accountability / lineage | `gold-lineage-emitter.ts`, RPC | `gold-accountability.test.ts` (2) | **READY_FOR_QA** |
| Metal conversion single authority | `post_metal_conversion_atomic` | migration `20260816041556` | **READY_FOR_QA** |
| Vault ledger as source of truth | `gold_ledger` + approved flows | integration via stores | **READY_FOR_QA** |
| Rule version on post | formula engine + declarative rules | formula-engine tests | **READY_FOR_QA** |

**Invariant:** No float storage for gold or money in canonical paths (paise / milligrams integers).

---

## Accounting

| Statement / flow | Source | Tests | Status |
|------------------|--------|-------|--------|
| Party ledger | universal ledger postings | accounting.test.ts | **READY_FOR_QA** |
| Trial balance / P&L / BS | `financial-statements.ts` from ledger | manual QA | **READY_FOR_QA** |
| Opening balances | `party-opening-balances.ts` canonical | — | **READY_FOR_QA** |
| Settlement gold tab | `GoldSettlementTab` + billing store | — | **READY_FOR_QA** |
| Purchase return | migration `20260816040000` | — | **READY_FOR_QA** |

---

## Payroll / attendance (configurable)

| Model | Store / config | Status |
|-------|----------------|--------|
| Monthly / weekly / daily / piece / gram | salary rules in customization | **READY_FOR_QA** |
| Attendance check-in/out | attendance routes | **READY_FOR_QA** |
| Formula versions | formula-engine + version refs on post | **READY_FOR_QA** |

---

## QA manual reconciliation checklist

1. Issue gold → receive → verify vault balance matches ledger sum  
2. Metal conversion: input lot → output lot → loss → fine reconciliation  
3. Customer gold deposit → liability remains until settlement  
4. Sale → party ledger → TB row matches  
5. Change wastage rule → new job uses new rule; old job unchanged  

---

## No duplicate gold authorities

Legacy duplicate conversion/melt writers resolved per `20260816070000_inventory_canonical_authority.sql`.
