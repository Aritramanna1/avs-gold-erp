# Chain Audit Template

Use one row per module. **VERIFIED** only when every applicable link is **WORKS**.

| Link | Question | Status |
|------|----------|--------|
| UI | Form renders, inputs bind, actions enabled when data ready | |
| Validation | Client + server rules; errors shown | |
| Store | Zustand/state updates; no stale cross-tenant data | |
| Service | Service/query uses firm_id + bounded limits | |
| Supabase | Correct table/RPC; RLS allows authorized only | |
| RPC | Atomic post where required; signatures match migrations | |
| DB | Read/write persists; audit fields set | |
| Calculation | Uses authoritative engine; purity/rate rules | |
| Ledger/stock | Posts reconcile to gold_ledger / inventory | |
| Report | Totals match ledger sample | |
| Print | Preview opens; content complete | |
| PDF | Download works; separate from print | |
| Share | Provider configured or manual fallback; no secrets in UI | |

**Status values:** WORKS | PARTIAL | BROKEN | STUB | N/A

**Module verdict:** VERIFIED only if no link is BROKEN/STUB (PARTIAL allowed only with documented owner blocker).
