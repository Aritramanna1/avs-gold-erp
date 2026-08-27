# Gap closure evidence — Docx SoT wave (2026-08-27)

## Locked docs
- `docs/AVS_ERP_PRODUCT_EDITION_PLANNING.docx` — Owner SoT (SHA-256 ECCCD3B9…2EF1), never rewritten
- `docs/AVS_ERP_PRODUCT_EDITION_PLANNING.LOCK.md` — pointer rules

## Editions
- Migration `20260827210000_docx_sot_plan_ladder_10_30_50.sql`: seed ₹10k/₹30k/₹50k; soft-hide AVS_20K_*; keep MTG assignable
- Platform UI: `AvsCatalogPricingPanel` filters `is_assignable`, labels ₹/year

## Calc / print / QR (already on main 2ed26c1 + this wave)
- `fineGoldMg` ÷999 retained; MTJ default purity 995
- Hisab hidden on customer invoice by default
- Public QR via `public-origin` + `document-verify-url`
- Print ≠ PDF (`PrintPreviewModal` html2canvas/jsPDF download)

## OAuth
- Locked callback `https://maatarajewellers.shop/auth/callback`
- Callback uses `pickDefaultRoute` after `get_authorization_context`
- Playwright: `e2e/tests/production-google-oauth.spec.ts`

## Rollback
- Keep `dist_go_20260826_190800.zip` / `index-CVsE73i6.js` forever
