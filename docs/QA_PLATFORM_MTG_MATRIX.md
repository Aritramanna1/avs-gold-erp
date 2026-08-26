/**
 * QA evidence matrix for Platform Access + MTG (Slice 5).
 * Fill PASS/FAIL during live verification after deploy.
 */
# Platform Access + MTG — QA Matrix

Date: 2026-08-27  
Branch: `main`  
Rollback zip: `dist_go_20260826_190800.zip`

## Automated

| Check | Result |
|-------|--------|
| `npm run typecheck` | PASS |
| `vitest` ma-tara + gold + entitlement-route-map | PASS |
| Catalog migration seeded 8 AVS_* plans | PASS (live DB) |
| Entitlement RLS + legacy bootstrap migrations | PASS (applied) |

## Manual (Platform Owner)

| Case | Steps | Expected | Result |
|------|-------|----------|--------|
| Set price | Platform → Plans → AVS catalog edit ₹ | Public/tenant sees new amount without redeploy | |
| Assign AVS_10K_RETAIL | Change Plan on firm | Features sync; retail-oriented nav | |
| Assign AVS_10K_MFG | Change Plan | Manufacturing modules enabled | |
| Assign AVS_20K_RETAIL | Change Plan | Mid retail pack | |
| Assign AVS_20K_MFG | Change Plan | Mid mfg pack | |
| Assign AVS_30K_RETAIL | Change Plan | Top retail pack | |
| Assign AVS_30K_MFG | Change Plan | Top mfg pack | |
| Assign AVS_50K_FULL | Change Plan | Full core modules | |
| Assign AVS_MTG | Change Plan | `/mtg` simple shell; AppShell not used | |
| Suspend / Activate | Subscriptions row | Status persists; audit event | |
| Disabled module deep-link | Open gated URL | 404/hide + write deny | |
| Firm isolation | Firm A session | Cannot read Firm B | |
| Refresh session | Reload | Entitlements reload | |

## Deploy

| Item | Value |
|------|-------|
| Target | maatarajewellers.shop |
| Live index hash (before) | index-CVsE73i6.js (GO) |
| Live index hash (after) | _(fill after deploy)_ |
| Rollback | Restore `dist_go_20260826_190800.zip` |
