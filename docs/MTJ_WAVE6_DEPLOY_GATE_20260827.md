# MTG completion — Hostinger deploy gate (Wave 6)

## Do not deploy yet

Live production remains **`index-CVsE73i6.js`** until Product Owner explicitly approves.

## Required before deploy

1. `npm run typecheck`
2. `npm run build`
3. Playwright: responsive-nav-oauth, public-qr-verify, mobile-nav-ia (local `E2E_BASE_URL=http://localhost:3000`)
4. Manual smoke: Platform Owner login → `/platform`; MTG firm → `/mtg`; Google redirect UX; melt calc with purity 995/916; Print Preview → Print vs Download PDF; scan QR on a generated invoice (incognito → `/doc/...` or `/verify?payload=...`)
5. Commit message must include `[release-approved]` for Version Safety CI
6. Keep CVsE73i6 recovery zip available

## After Owner says “deploy”

Use existing Hostinger upload scripts only — do not change domain.
