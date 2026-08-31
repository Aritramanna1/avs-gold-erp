# FINAL STAGING DEPLOYMENT REPORT — Ornexa V1

**Date:** 2026-08-16  
**Environment:** TEST/STAGING ONLY

---

## Targets

| Environment | URL | Deployed this pass |
|-------------|-----|-------------------|
| **STAGING** | `https://avs-erp-preview-20260806.hostingersite.com` | **Partial** — prior build live (HTTP 200); new build packaged |
| **BETA/PROD** | `maatarajewellers.shop` | **NOT DEPLOYED** (per instruction) |

---

## This pass

| Step | Result |
|------|--------|
| `npm run build` with `VITE_APP_ENV=staging` | **PASS** |
| Sitemap canonical | `https://avs-erp-preview-20260806.hostingersite.com` |
| `node scripts/deploy-staging.mjs` upload | **FAILED** — Hostinger API `401 Unauthenticated` |
| Artifact | `dist_staging_20260816_121900.zip` (manual upload fallback) |
| Staging HTTP check | **200 OK** (previous deploy still serving) |

---

## Build configuration (staging)

```
VITE_APP_ENV=staging
VITE_PUBLIC_APP_URL=https://avs-erp-preview-20260806.hostingersite.com
VITE_GOOGLE_OAUTH_ENABLED=true
VITE_FORCE_ONLINE=true
```

Supabase project: linked via `.env` (not committed).

---

## Migrations on remote Supabase

Latest applied include:
- `unified_authorization_context` (20260816052446)
- `public_website_cms` (20260816063049)
- `website_bundle_downloads` (20260816064218)

Run `supabase migration list` locally to compare if drift suspected.

---

## PO action to complete staging deploy

1. Regenerate **Hostinger API token** with file upload scope  
2. `export HOSTINGER_API_TOKEN=...`  
3. `node scripts/deploy-staging.mjs`  
   OR upload `dist_staging_20260816_121900.zip` via Hostinger File Manager → extract to `public_html`

---

## Post-deploy callbacks (staging)

| Service | URL |
|---------|-----|
| Supabase Auth redirect | `https://avs-erp-preview-20260806.hostingersite.com/auth/callback` |
| Google OAuth origin | same staging host |
| Razorpay webhook (test) | `https://<project>.supabase.co/functions/v1/razorpay-webhook` |
| R2 storage proxy | `VITE_R2_PROXY_URL` from env |

See [GOOGLE_OAUTH_STAGING.md](./GOOGLE_OAUTH_STAGING.md).

---

## Version

- Package: `avs-gold-erp@1.1.1`
- Branch: `v1-final-qa-handoff-20260816`
