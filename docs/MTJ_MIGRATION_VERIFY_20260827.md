# MASTER FINAL — Migration note (2026-08-27)

## Rule
CREATE → APPLY → VERIFY → TEST. Do **not** blindly replay historical migrations.

## Additive migrations (on `main` + applied to live `dqgrrafuoxaorvyrcuuh`)

| Version | Purpose | Applied |
|---------|---------|---------|
| `20260827013000` | Ma Tara pure gold reference 995 | Yes (remote history) |
| `20260827020000` | AVS plan/edition catalog + MTG | Yes (remote history) |
| `20260827021000` | Entitlement write-path parity | Yes (remote history) |
| `20260827022000` | Entitlement legacy bootstrap | Yes (remote history) |
| `20260827030000` | Platform access gap closure | Yes (remote history) |
| `20260827180000` | Inventory conversion fine /999 (10-arg) | **Yes — 2026-08-27 via linked CLI** |
| `20260827210000` | Docx SoT plan ladder 10/30/50 | **Yes — 2026-08-27 via linked CLI** |
| `20260827220000` | Public verify rate-limit RPC | **Yes — 2026-08-27 via linked CLI** |
| `20260827230000` | Alloy-lines conversion fine /999 | **Yes — 2026-08-27 via linked CLI** |

## Verify snapshots (post-apply)

- `platform_plans`: AVS_10K_* = 1000000 paise assignable; AVS_30K_* = 3000000; AVS_50K_FULL = 5000000; AVS_20K_* `is_assignable=false`; AVS_MTG assignable.
- Both `rpc_execute_inventory_metal_conversion` overloads use `/ 999`.
- `consume_public_rate_limit('migrate:smoke', 5, 60)` → `{ allowed: true }`.

## Note on Supabase MCP
Project MCP OAuth channel failed in-session (`Failed to clear OAuth state`). Migrations were applied with `supabase db query --linked -f …` then `migration repair --status applied` so history matches reality. Re-auth MCP when the IDE channel is healthy; do **not** re-run these SQL files blindly.

## Do not
- `supabase db push` wholesale (remote/local history drift).
- Mass `migration repair` revert without Owner order.
