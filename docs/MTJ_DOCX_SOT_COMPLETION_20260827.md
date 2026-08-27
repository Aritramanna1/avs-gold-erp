# Docx SoT completion evidence — 2026-08-27

## Phase A — Documentation lock
- `docs/AVS_ERP_PRODUCT_EDITION_PLANNING.docx` SHA-256 `ECCCD3B9…2EF1` = Owner Download (unchanged)
- `docs/AVS_ERP_PRODUCT_EDITION_PLANNING.LOCK.md` — no rewrite rule + 10/30/50 ladder note

## Phase B — Product harden
- Plan ladder migration: `supabase/migrations/20260827210000_docx_sot_plan_ladder_10_30_50.sql`
- Platform: `AvsCatalogPricingPanel` DB `price_minor` only; assignable filter
- MTG bundle notes + `hiddenByDefaultModules` + `docxEditionLadder`
- Assistant opening gold uses `fineGoldMg` + default purity **995** (not ×0.916)
- Entitlement denylist: Scheme / Boolean / Box for MTG (hide≠delete)
- Print Hisab-off invoice; public QR; Print≠PDF (prior commits)

## Phase C — Google OAuth
- Locked callback `https://maatarajewellers.shop/auth/callback`
- Provider callback `https://dqgrrafuoxaorvyrcuuh.supabase.co/auth/v1/callback`
- Role redirect via `pickDefaultRoute`
- Playwright production smoke required after each deploy

## Phase D — Deploy
- Rollback forever: `dist_go_20260826_190800.zip` / `index-CVsE73i6.js`
- Live claim only with matching build hash from `main`
