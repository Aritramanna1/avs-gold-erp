# Test Credentials

## Supabase (STAGING/DEV project — do NOT treat as production)

- Project ref: kjfjsfhftytezsjyegmb
- URL: https://kjfjsfhftytezsjyegmb.supabase.co
- Publishable (anon) key: sb_publishable_fThRlMsK8N5t_wU9_fzd7g_XBvvr-zW
- Secret key (server-side admin, Data API + Auth admin only — CANNOT run DDL): sb_secret_2DQR8W7PT_WBuBSnhxnJxA_WxoKB98z
- NOTE: secret key is in /app/.env as SUPABASE_SECRET_KEY (NOT VITE_ prefixed, so never exposed to the browser bundle).

## App Super Owner test account (staging) — CREATED & VERIFIED

- Email: staging.superowner@mtj-erp.test
- Password: StagingOwner@2025
- Role: Super Owner (added to app_settings firm.users[] + Supabase Auth, email confirmed)
- Auth UID: 7d140df8-7290-4680-bb56-1031a1f1f8e3
- Login verified via password grant (access_token returned).
- Existing real accounts (DO NOT MODIFY): aritramanna222@gmail.com (Super Owner), games48480@gmail.com (Owner)

## Pending from user

- Supabase Personal Access Token (sbp_...) OR database password — required to apply DDL migration
  and to deploy the send-email Edge Function. Secret key alone is insufficient for DDL/function deploy.
