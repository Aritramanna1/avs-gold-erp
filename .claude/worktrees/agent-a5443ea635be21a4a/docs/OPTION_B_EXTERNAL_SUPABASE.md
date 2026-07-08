# MTJ ERP — Option B: External Supabase (Production)

Target backend (production):

- Project ref: `kjfjsfhftytezsjyegmb`
- URL: `https://kjfjsfhftytezsjyegmb.supabase.co`
- Publishable key: `sb_publishable_fThRlMsK8N5t_wU9_fzd7g_XBvvr-zW`
- Owner email: `games48480@gmail.com`

This document is the single source of truth for moving MTJ ERP off Lovable
Cloud and onto the customer-owned Supabase project. Web and Electron both
use the SAME online Supabase database. No local-only database, no service
role key in any client bundle.

---

## 1. Apply the schema (one SQL file)

File: `docs/option_b_schema.sql` (idempotent — safe to re-run).

Contains: all 23 ERP tables, `set_updated_at()` trigger, `app_role` enum,
`user_roles` table, `has_role()` security-definer function,
`handle_new_user_role()` trigger on `auth.users`, GRANTs to
`authenticated` + `service_role`, and strict RLS policies (read = any
signed-in user, write = signed-in AND not `viewer`).

Steps:

1. Open the external Supabase project SQL Editor for `kjfjsfhftytezsjyegmb`.
2. Paste the entire contents of `docs/option_b_schema.sql`.
3. Run. Expect "Success. No rows returned."
4. (Optional) Re-run — every statement is `IF NOT EXISTS` / `DROP … IF
EXISTS` / `ON CONFLICT DO NOTHING`. Re-running will not destroy data.

Verify in SQL Editor:

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema='public' ORDER BY 1;
-- expect 24 rows (23 ERP tables + user_roles)

SELECT typname FROM pg_type WHERE typname='app_role';
-- expect 1 row

SELECT proname FROM pg_proc WHERE proname IN
 ('set_updated_at','has_role','handle_new_user_role');
-- expect 3 rows
```

---

## 2. Configure Auth (in the Supabase dashboard)

1. Authentication → Providers → Email: ENABLE. Disable "Confirm email" only
   if the customer accepts the trade-off; otherwise leave on.
2. Authentication → Providers → Google: enable, paste Google OAuth client
   ID + secret. Add redirect URI for the deployed web URL.
3. Authentication → URL Configuration: set Site URL to the deployed web URL
   (e.g. `https://erp.maatara.example`) and add it to Redirect URLs.
4. Authentication → Settings: turn ON "Leaked password protection" (HIBP).

---

## 3. Create the owner user

The owner trigger from step 1 auto-assigns the `owner` role to anyone who
signs up with `games48480@gmail.com`. So:

1. Deploy the web build (see `docs/DEPLOY_WEB.md`) OR run locally pointed at
   the external Supabase project.
2. Open the app, click Sign Up, register with `games48480@gmail.com`, set a
   strong password. (Password is NEVER stored in git or docs.)
3. Run `docs/OWNER_SETUP.sql` in the SQL Editor to verify and re-assert the
   owner role. Final query should print `roles = {owner}`.

---

## 4. Configure the app

1. Copy `.env.example` to `.env` (already contains the new project values).
2. Local dev: `bun install && bun run dev` — should connect to the external
   Supabase, login should work for the owner.
3. Web build: `bun run build` → upload `dist/` to Horizon (see
   `docs/DEPLOY_WEB.md`).
4. Electron: set `MTJ_ERP_URL` to the deployed web URL, then
   `cd electron-app && npm install && npm run package:win` (see
   `docs/BUILD_ELECTRON.md`).

The browser, Vite SSR, and Electron all read the publishable key only.
`SUPABASE_SERVICE_ROLE_KEY` is never in `.env`, never in `dist/`, never in
the Electron package. If a backend job ever needs admin access, set the
service role key in Horizon's secret manager and read it ONLY in a server
function — never reach for it from client code.

---

## 5. Production verification checklist

See `docs/PRODUCTION_CHECKLIST.md` for the full live-workflow run.

---

## Old project references (do NOT use)

- `pyvuiyzjabggnjbuvzsj` — old Lovable Cloud backend. Superseded.
- `zbfbnwgbqydttsuuhmxn` — old dev Supabase. Superseded.

Both are kept in this document for historical reference only. No code or env
file should reference either ref in production.
