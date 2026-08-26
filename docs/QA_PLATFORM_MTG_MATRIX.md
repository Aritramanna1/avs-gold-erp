/**
 * QA evidence matrix for Platform Access + MTG (Slice 5).
 * Fill PASS/FAIL during live verification after deploy.
 */
# Platform Access + MTG — QA Matrix

Date: 2026-08-27  
Branch: `main` @ `61dd2f7` (on top of GO `8dc1c43`)  
Rollback zip: `dist_go_20260826_190800.zip` → `index-CVsE73i6.js`

## Automated

| Check | Result |
|-------|--------|
| Master reset Hostinger to GO | PASS (`index-CVsE73i6.js`) |
| `origin/main` = `8dc1c43` then additive commit | PASS |
| `npm run typecheck` | PASS |
| `vitest` ma-tara + gold + entitlement-route-map | PASS (22) |
| Catalog + entitlement migrations live | PASS (`20260827013000`–`22000` local=remote) |
| Build + deploy from `main` | PASS |
| Live index after deploy | `index--O40jwhI.js` |
| GO rollback zip retained | PASS |

## Manual (Platform Owner)

| Case | Steps | Expected | Result |
|------|-------|----------|--------|
| Set price | Platform → Plans → AVS catalog edit ₹ | Public/tenant sees new amount without redeploy | PENDING owner |
| Assign AVS_* / AVS_MTG | Change Plan | Features sync; MTG → `/mtg` shell | PENDING owner |
| Suspend / Activate | Subscriptions row | Status persists | PENDING owner |
| Disabled module deep-link | Open gated URL | 404/hide + write deny | PENDING owner |
| Firm isolation | Firm A session | Cannot read Firm B | PENDING owner |

## Deploy

| Item | Value |
|------|-------|
| Target | maatarajewellers.shop |
| Live index hash (GO restore) | index-CVsE73i6.js |
| Live index hash (after main deploy) | index--O40jwhI.js |
| Rollback | Restore `dist_go_20260826_190800.zip` via `scripts/restore-hostinger-from-zip.mjs` |
