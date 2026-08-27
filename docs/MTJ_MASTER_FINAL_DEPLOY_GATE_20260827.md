# MASTER FINAL — Deploy gate (do not Hostinger-overwrite without Owner)

## Foundation (immutable rollback)
- Live currently: `index-CVsE73i6.js`
- Zip: `dist_go_20260826_190800.zip`
- Git baseline: `8dc1c43` / `production-baseline-cvse73i6`

## This program
Additive work on `main` from that baseline (MTJ/MTG editions, bundles, calc wiring, print/QR, platform, portals, mobile).

## Deploy only when Owner says go
1. `npm run typecheck` PASS
2. `npm run build` PASS
3. Focused Playwright + unit evidence
4. Commit message includes `[release-approved]`
5. Upload dist via Hostinger script
6. Verify live index hash matches **this** build (new Vite hash expected)
7. Keep CVsE73i6 zip for rollback forever

**Status:** Source ready for Owner-gated deploy — Hostinger **not** overwritten in this session.
