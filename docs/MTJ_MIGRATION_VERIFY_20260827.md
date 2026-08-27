# MASTER FINAL — Migration note (2026-08-27)

## Rule
CREATE → APPLY → VERIFY → TEST. Do **not** blindly replay historical migrations.

## Local additive migrations (present on `main`)
- `20260827013000_ma_tara_pure_gold_reference_995.sql`
- `20260827020000_avs_plan_edition_catalog_mtg.sql`
- `20260827021000_entitlement_write_path_parity.sql`
- `20260827022000_entitlement_legacy_bootstrap_safe.sql`
- `20260827030000_platform_access_gap_closure.sql`
- `20260827180000_fix_conversion_fine_gold_div999.sql`

## Remote status
`supabase db push --linked` reports remote history versions that are **not** in this baseline's local `supabase/migrations/` tree (pre-existing Hostinger/Supabase history drift). Repairing hundreds of remote versions is out of scope for this additive wave and risks production schema churn.

These `20260827*` migrations were previously applied during the discarded tip work on the same Supabase project (`dqgrrafuoxaorvyrcuuh`). Treat as **verify-first**: confirm plan/edition/entitlement RPCs in Platform UI before re-applying.

## Operator action if Platform plans missing
Apply only the six files above via SQL editor / targeted `supabase db execute` after confirming they are absent — never `migration repair` mass-revert without Owner order.
