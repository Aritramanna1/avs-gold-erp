# MTG completion — Hostinger deploy gate (Wave 6)

## Do not deploy yet

Live production remains **`index-CVsE73i6.js`** on **`https://maatarajewellers.shop`** until Product Owner explicitly approves.

Default site truth: maatarajewellers.shop — no domain migration in this program.

## Required before deploy

1. `npm run typecheck` — PASS (completion wave)
2. `npm run build` — required
3. Playwright (local `E2E_BASE_URL=http://localhost:3000`, `PLAYWRIGHT_UNAUTH_ONLY=1` as needed):
   - `e2e/tests/responsive-nav-oauth.spec.ts`
   - `e2e/tests/public-qr-verify.spec.ts`
   - `e2e/tests/mobile-nav-ia.spec.ts` (needs auth state)
4. Manual smoke:
   - Platform Owner → `/platform`
   - MTG firm → `/mtg`
   - Google → “Redirecting to Google…” → `/auth/callback` → `/app` (not marketing `/`)
   - Melt: change purity 995/916 → live fine recalc (`fineGoldMg` ÷999)
   - Print Preview → **Print** (OS dialog) vs **Download PDF**
   - Invoice QR: enable `printVerificationQrEnabled` → scan → incognito `/doc/{token}` (no localhost)
   - Customer Hisab: default **hidden** on retail invoice; opt-in via Customization print prefs
5. Apply pending migration if not yet on live DB: `20260827180000_fix_conversion_fine_gold_div999.sql`
6. Commit message must include `[release-approved]` for Version Safety CI
7. Keep CVsE73i6 recovery zip available

## After Owner says “deploy”

Use existing Hostinger upload scripts only — do not change domain.
