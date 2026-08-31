# Google OAuth — Staging Setup

Staging builds enable the **Continue with Google** button automatically (`VITE_APP_ENV=staging` or `VITE_GOOGLE_OAUTH_ENABLED=true`).

Production keeps Google sign-in hidden until you explicitly set `VITE_GOOGLE_OAUTH_ENABLED=true` on the production build.

## Supabase (required for OAuth to work)

1. Open **Supabase Dashboard → Authentication → Providers → Google**.
2. Enable Google and paste your **Google Cloud OAuth Client ID and Secret**.
3. Add authorized redirect URLs:
   - `https://avs-erp-preview-20260806.hostingersite.com/auth/callback` (staging)
   - `https://<your-production-domain>/auth/callback` (when production is ready)
4. In **Authentication → URL Configuration**, set **Site URL** to the environment base URL and add the same callback paths under **Redirect URLs**.

## Google Cloud Console

Create an OAuth 2.0 Web client with authorized JavaScript origins:

- `https://avs-erp-preview-20260806.hostingersite.com`

Authorized redirect URI (handled by Supabase):

- `https://<project-ref>.supabase.co/auth/v1/callback`

## Deploy

`scripts/deploy-staging.mjs` sets `VITE_GOOGLE_OAUTH_ENABLED=true` on every staging bundle.

**Blocker:** Until Supabase Google provider credentials are saved, the button appears but sign-in will fail with a provider error.
