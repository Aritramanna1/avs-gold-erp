# MTJ ERP — Web Deployment (Horizon / static host)

The web build is a TanStack Start app that talks directly to the external
Supabase project `kjfjsfhftytezsjyegmb` using the publishable key only.
No Lovable Cloud dependency.

## 1. Configure env

`.env` (or your host's env vars) MUST contain:

```
VITE_SUPABASE_URL=https://kjfjsfhftytezsjyegmb.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_fThRlMsK8N5t_wU9_fzd7g_XBvvr-zW
VITE_SUPABASE_PROJECT_ID=kjfjsfhftytezsjyegmb
SUPABASE_URL=https://kjfjsfhftytezsjyegmb.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_fThRlMsK8N5t_wU9_fzd7g_XBvvr-zW
SUPABASE_PROJECT_ID=kjfjsfhftytezsjyegmb
```

`SUPABASE_SERVICE_ROLE_KEY` is set ONLY in the host's secret manager, never
in `.env`, never in the git repo, never in `dist/`.

## 2. Build

```
bun install
bun run build
```

Output is `dist/` (or the framework's configured output dir). Verify:

```
rg pyvuiyzjabggnjbuvzsj dist/   # must return nothing
rg SUPABASE_SERVICE_ROLE_KEY dist/   # must return nothing
```

## 3. Upload to Horizon

1. Zip `dist/`:

```
cd dist && zip -r ../mtj-erp-web.zip . && cd ..
```

2. Upload `mtj-erp-web.zip` to your Horizon project (or extract to your VPS
   web root). Configure Horizon to serve `index.html` as SPA fallback.
3. Set the env vars above in Horizon's project settings.
4. Re-deploy.

## 4. Configure Supabase Auth redirects

In the Supabase dashboard for `kjfjsfhftytezsjyegmb`:

- Authentication → URL Configuration:
  - Site URL: the public web URL (e.g. `https://erp.maatara.example`)
  - Redirect URLs: add the same URL

Without this, email confirmation and Google OAuth callbacks fail.

## 5. Verify

Open the deployed URL, sign up as `games48480@gmail.com`, run
`docs/OWNER_SETUP.sql`, then walk `docs/PRODUCTION_CHECKLIST.md`.
