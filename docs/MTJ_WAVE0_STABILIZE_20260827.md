# MTG completion — Wave 0 stabilize (2026-08-27)

## Locked live foundation

- Hostinger production remains **`index-CVsE73i6.js`** / git **`8dc1c43`**.
- Default production site: **`https://maatarajewellers.shop`** (do not migrate in this program).
- Do **not** redeploy until Product Owner explicitly approves after QA.
- Recovery: keep existing `dist_*` / Hostinger rollback zips; do not overwrite LKG.

## Current code line

- Git tip (additive on foundation): **`53ba62c`** — mobile/OAuth, calc discipline, config, public QR (`[release-approved]`).
- Ancestor MTJ/Platform wave: **`f21ec07`** on **`8dc1c43`**.

## Non-goals this wave

- Domain/hosting migration
- Second ERP / shell / WebView
- Second rollback of production
- Mass remote branch deletion (preserve `prod-go-20260826` / `prod/locked-20260827` tags)