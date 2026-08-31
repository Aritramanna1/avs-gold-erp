# Moving Ornexa public site to a new domain

When you purchase the final Ornexa domain:

1. **Build env** — set `VITE_PUBLIC_APP_URL=https://new-domain.com` before `npm run build` or `node scripts/deploy-beta.mjs`.
2. **Supabase Auth** — update Site URL + Redirect URLs (see `GOOGLE_OAUTH_OWNER_CHECKLIST.md`).
3. **Google Cloud** — add new origin + keep Supabase callback URI.
4. **Hostinger** — deploy with `DEPLOY_DOMAIN=new-domain.com node scripts/deploy-beta.mjs`.
5. **R2 storage proxy** — add new origin to `workers/storage-proxy` CORS `ALLOWED_ORIGIN`.
6. **sitemap.xml** — regenerated automatically by `scripts/generate-sitemap.mjs` from `VITE_PUBLIC_APP_URL`.

No application code changes required if `VITE_PUBLIC_APP_URL` is set correctly at build time.
