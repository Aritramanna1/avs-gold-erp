# Claude Code Review Verification Matrix

This matrix records findings verified during the MTJ production stabilisation pass. It is evidence, not a deployment approval.

| Area | Finding / claim | Verification | Status | Evidence |
|---|---|---|---|---|
| Frontend compilation | TypeScript compiles | `npm run typecheck` | Verified | Passed on 2026-07-30 |
| Production build | Vite production build succeeds | `npm run build` | Verified with warnings | Build passed; large chunks and ineffective dynamic imports remain |
| Lint | New conversion/workshop/settings code had formatting failures | `npm run lint -- --quiet` after Prettier correction | Fixed and verified | Quiet lint passed |
| Multi-tenancy | Archived deployment report says true SaaS isolation was absent | Read `docs/DEPLOYMENT_READINESS_REPORT.md` and inspected legacy policies | Confirmed limitation | Legacy tables still contain permissive policies and lack universal firm scope |
| New manufacturing tables | Three new tables allowed authenticated cross-tenant reads and deletes | Inspected `20260730110000_manufacturing_v1_1_phase2to5_tables.sql` | Fixed in working tree | Added `firm_id`, firm-scoped policies, removed delete policy |
| Gold ledger atomicity | New stores post ledger and history in separate client requests | Traced `metal-conversion-store.ts`, `customer-gold-deposit-store.ts`, and `workshop-process-store.ts` | Open high risk | Requires transactional Supabase RPC/service boundary |
| End-to-end smoke tests | Local smoke run did not complete in the test window | `npm run test:e2e -- --grep 'core|smoke'` | Blocked | Local server/auth fixture did not return a result; no assertion result claimed |
| Supabase deployment | CLI is unavailable in the current shell | `supabase --version` | Blocked | Migration application/advisor verification requires authenticated Supabase tooling |

## Current release gate

The repository is compile- and lint-clean, but it is not yet approved for multi-tenant production deployment. The remaining release blockers are database-side tenant isolation for legacy tables, transactional critical operations, authenticated RLS tests, and a completed E2E environment.
