# Public website — your action items (Owner / OOI)

Everything below requires **your** credentials or business decisions. The codebase and deploy scripts are ready.

**Current test domain:** `https://maatarajewellers.shop`  
**Future domain:** set `VITE_PUBLIC_APP_URL` + DNS — see [DOMAIN_MIGRATION.md](./DOMAIN_MIGRATION.md)

---

## 1. Google OAuth (required for “Continue with Google”)

Full steps: [GOOGLE_OAUTH_OWNER_CHECKLIST.md](./GOOGLE_OAUTH_OWNER_CHECKLIST.md)

| Where | What |
|--------|------|
| Google Cloud | OAuth Web client — origins: `https://maatarajewellers.shop` |
| Google Cloud | Redirect URI: `https://<PROJECT_REF>.supabase.co/auth/v1/callback` |
| Supabase | Providers → Google → Client ID + Secret |
| Supabase | URL config → Site URL `https://maatarajewellers.shop`, redirect URLs include `/auth/callback` |

---

## 2. Deploy to maatarajewellers.shop

```bash
# Set in shell or .env (never commit secrets)
export HOSTINGER_API_TOKEN=...
export VITE_SUPABASE_URL=...
export VITE_SUPABASE_PUBLISHABLE_KEY=...
export VITE_SUPABASE_PROJECT_ID=...
export VITE_R2_PROXY_URL=...
export VITE_LICENSE_ENDPOINT=...
export VITE_GOOGLE_OAUTH_ENABLED=true

node scripts/deploy-beta.mjs
```

Optional: `DEPLOY_DOMAIN=yournewdomain.com` when you buy the new domain.

---

## 3. Supabase migrations

Apply on your Supabase project (Dashboard SQL or CLI):

- `supabase/migrations/20260816120000_public_website_cms.sql`
- `supabase/migrations/20260816130000_website_bundle_downloads.sql`

Without these, the site still works with **defaults**; CMS, leads, and media upload need the migration.

---

## 4. Website Manager (after deploy + login as Platform Owner)

Go to **Platform → Website Manager** (`/platform/website`):

| Task | Tab |
|------|-----|
| Real WhatsApp number | Contact |
| Upload ERP screenshots (hero) | Screenshots — page `home`, slot `hero` |
| SEO title + description + ad preview | SEO & Social |
| Facebook / Instagram / LinkedIn / YouTube | SEO & Social |
| Enable download centre when builds exist | Downloads + enable **Downloads** flag |
| Turn on Blog / What's New when ready | Flags |

---

## 5. Pricing page

**Platform → Plans** — mark plans **Publicly visible** and set `pricing_display_mode` (show price vs contact sales).

---

## 6. Google Search / ads (after live)

1. [Google Search Console](https://search.google.com/search-console) — add property `maatarajewellers.shop`, verify DNS or HTML file.
2. Submit sitemap: `https://maatarajewellers.shop/sitemap.xml`
3. Target keywords already in meta: *jewellery ERP*, *jewellery manufacturing software*, *gold ERP India*, *karigar management*, *Ornexa*.

---

## 7. What the agent already did

- Public marketing routes (`/`, `/pricing`, `/contact`, `/features`, `/faq`, `/downloads`, …)
- ERP at `/app` (homepage never auto-redirects when logged in)
- SEO component + `sitemap.xml` + `robots.txt`
- Website Manager CMS tabs (flags, contact, screenshots, SEO, downloads)
- `deploy-beta.mjs` for maatarajewellers.shop
- Domain-flexible `VITE_PUBLIC_APP_URL`

---

*Last updated: 2026-08-16*
