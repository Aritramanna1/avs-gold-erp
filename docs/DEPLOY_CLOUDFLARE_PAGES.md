# Deploy MTJ ERP to Cloudflare Pages (via GitHub)

## 1. Push repo to GitHub

Create a new GitHub repo and push this codebase. Do **NOT** commit `.env`.
Only `.env.example` should be in the repo.

## 2. Create the Cloudflare Pages project

Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** →
**Connect to Git** → select your GitHub repo.

### Build settings

| Field                  | Value                                |
| ---------------------- | ------------------------------------ |
| Framework preset       | **Vite**                             |
| Build command          | `bun run build` (or `npm run build`) |
| Build output directory | `dist`                               |
| Root directory         | _(leave blank — project root)_       |
| Node version           | `20` or newer                        |

### Environment variables (Production **and** Preview)

| Variable                        | Value                                            |
| ------------------------------- | ------------------------------------------------ |
| `VITE_SUPABASE_URL`             | `https://kjfjsfhftytezsjyegmb.supabase.co`       |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_fThRlMsK8N5t_wU9_fzd7g_XBvvr-zW` |

**Never** add `SUPABASE_SERVICE_ROLE_KEY`, the database password, the JWT
secret, or any `sb_secret_*` value. Those are server-only and must not be in
a frontend bundle.

## 3. First deploy

Click **Save and Deploy**. Cloudflare will install deps, run `bun run build`,
and publish `dist/` (which already includes `_redirects` for SPA fallback).

After it finishes you'll get a URL like:

```
https://<project-name>.pages.dev
```

## 4. SPA routing

`public/_redirects` contains:

```
/*    /index.html   200
```

This makes direct URLs and hard refreshes work for every route
(`/people`, `/orders`, `/workshop`, `/billing`, `/settings`, `/verify`,
etc.). No extra config needed.

## 5. Update Supabase Auth redirect URLs

Supabase Dashboard → **Authentication** → **URL Configuration**:

**Site URL**:

- `https://<project-name>.pages.dev` (or your custom domain once added)

**Redirect URLs** (add all of these):

- `https://<project-name>.pages.dev/**`
- `https://<your-custom-domain>/**` _(once you add a custom domain)_
- `http://localhost:8080/**`
- `http://127.0.0.1:8080/**`

## 6. Custom domain (optional)

Cloudflare Pages → project → **Custom domains** → **Set up a custom domain**.
After it's live, also add it to Supabase Redirect URLs above.

## 7. Continuous deployment

Every push to the default branch triggers a fresh build automatically.
Pull-request branches build to preview URLs.

## 8. Post-deploy smoke checks

- [ ] App opens on the Pages URL
- [ ] Login works
- [ ] Refresh on `/orders` does **not** 404
- [ ] Supabase data loads
- [ ] Invoice / payment save & reload works
- [ ] Print / QR works
- [ ] Backup / export works
- [ ] Bundle contains no service role key (`grep -r "service_role" dist/` returns nothing)
- [ ] Gold Balance Sheet balanced
