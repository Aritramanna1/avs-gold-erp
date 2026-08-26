# Master Reset DB Audit — 2026-08-27

## Baseline

| Item | Value |
|------|-------|
| Restored source | `8dc1c43` (`stable/production-last-known-good-20260827`) |
| Restored Hostinger | `index-CVsE73i6.js` via `dist_go_20260826_190800.zip` |
| Live verify | 2026-08-27 — `LIVE_GO_OK`, `/login` 200 |
| Data policy | **No destructive reset** — production rows preserved |

## Live migrations since 2026-08-26 (keep)

Applied on production Supabase (not rolled back):

- Portal / invoice verification / rate-limit / ULE reverse / party opening (GO-era)
- Manufacturing CoA economics seeds (`20260826141830`–`20260826161003`) — additive schema/seed; GO app does not require them to boot
- `20260827013000` Ma Tara pure gold reference 995 seed
- `20260827020000` AVS plan × edition catalog + `AVS_MTG` (price_minor=0)
- `20260827021000` entitlement RESTRICTIVE policies (observed: `orders_entitlement_restrict`, `catalog_designs_entitlement_restrict`)
- `20260827022000` legacy bootstrap for `tenant_module_write_allowed` (empty `organization_features` → allow)

## Classification

| Change | Verdict |
|--------|---------|
| AVS_* plans + columns | **KEEP** — additive commercial catalog |
| 995 firm settings seed | **KEEP** — owner-locked default |
| RESTRICTIVE entitlement RLS | **KEEP with bootstrap** — safe for GO while feature rows empty/present; re-verify write paths after FE entitlements land |
| Economics CoA migrations | **KEEP data** — do not drop; not required by GO UI |
| Destructive migration rewind | **REJECTED** |

## Soften actions

None required for GO restore: `tenant_module_write_allowed` already fail-opens when a firm has zero `organization_features` rows; subscribed firms were backfilled.

## Next

Bring FE + migration files onto `main` from `archive/drift-platform-mtg-20260827` (additive re-implement). Migrations already live — re-apply SQL only if checksum drift; otherwise commit files for history parity.
