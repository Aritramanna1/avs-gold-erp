# MASTER FINAL — live evidence 2026-08-27

## Migrations (Supabase `dqgrrafuoxaorvyrcuuh`)
Applied via `supabase db query --linked` (MCP OAuth channel broken in-session):

- `20260827180000` fine conversion /999
- `20260827210000` docx 10/30/50 plan ladder
- `20260827220000` `consume_public_rate_limit`
- `20260827230000` alloy-lines conversion /999

Verified: both RPC overloads use `/999`; plans priced 10/30/50; rate-limit RPC returns `{allowed:true}`.

## Build + deploy
- Commit: `4d649c9` on `main` (`[release-approved]`)
- Built asset: `index-DkMGoO2t.js`
- Hostinger upload: 562/562 fail=0
- Live HTML references: `index-DkMGoO2t.js` (HTTP 200)
- Rollback SoT unchanged: `dist_go_20260826_190800.zip` = CVsE73i6

## QA
- Unit: gold.calculations + google-oauth-redirect — 18 passed
- Playwright production OAuth (`E2E_BASE_URL=https://maatarajewellers.shop`):
  - Continue with Google visible — PASS
  - locked `redirect_to=https://maatarajewellers.shop/auth/callback` reaches Google — PASS
  - OAuth cancel stays on `/auth/callback` (no marketing 404) — PASS
  - Full interactive Google login — SKIPPED (needs Owner `GOOGLE_E2E_EMAIL` / `GOOGLE_E2E_PASSWORD`)

## Note
Supabase MCP `mcp_auth` failed (`Failed to clear OAuth state`). Re-auth in Cursor when channel is healthy; DB work already applied via linked CLI.
