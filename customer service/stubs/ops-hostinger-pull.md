# P0-1: Hostinger Pull Live Sync (erp.arivahly.in)

## Goal
Safely synchronize the canonical production tip from git repository (`main` / `release/community-testing-v1.1.2`) to the live managed domain `https://erp.arivahly.in`, ensuring that all navigation, branding, rate-chip, and service-worker fixes are actively running on Hostinger with zero disruption to `maatarajewellers.shop`.

## Current tip evidence (paths)
- Git repository: `https://github.com/Aritramanna1/avs-gold-erp.git` (canonical) and `https://github.com/Aritramanna1/avs-erp-hostinger-live.git` (deployment mirror).
- Active tested branch: `release/community-testing-v1.1.2` (HEAD: `8630e64`).
- Direct deploy runner: `scripts/upload-dist-multi.mjs` (uploads `dist/` directly via Hostinger API to `erp.arivahly.in`).
- Health probe: `https://erp.arivahly.in/api/health.php` &rarr; returns `status: healthy`, LiteSpeed/PHP 8.2+.
- Web root on Hostinger: `public_html/erp/` (mapped to `erp.arivahly.in`).

## Changes (files / migrations / Hostinger)
1. **Hostinger hPanel Git Pull Checklist (Owner Action)**:
   - Login to Hostinger hPanel &rarr; Websites &rarr; `arivahly.in` (or `erp.arivahly.in` subdomain).
   - Navigate to **Git** in the advanced menu.
   - Verify remote repository: `https://github.com/Aritramanna1/avs-erp-hostinger-live.git`.
   - Branch: `release/community-testing-v1.1.2` or `main`.
   - Click **Deploy / Pull**.
2. **Automated API Sync (Scripted Fallback)**:
   - Run `node scripts/upload-dist-multi.mjs erp.arivahly.in` to push built assets to `public_html/erp/`.
3. **Hard Constraint**:
   - `maatarajewellers.shop` is permanently protected; never deploy tip or run Git pull against the shop web root.

## Acceptance
- `curl -s https://erp.arivahly.in` serves the latest Vite script bundle (e.g. `index-D0MU80qW.js`).
- `curl -s https://erp.arivahly.in/sw.js` returns `CACHE = "ornexa-shell-v3"`.
- `https://erp.arivahly.in/api/health.php` responds with HTTP 200 `{"status": "healthy"}`.
- Zero impact on `maatarajewellers.shop`.

## Out of scope
- Merging untested experimental feature branches into `main`.
- Touching `maatarajewellers.shop` DNS or web files.

## Status: Done
