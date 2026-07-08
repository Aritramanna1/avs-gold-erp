# MTJ ERP — Production Handover (Option B)

Production stack:

- Frontend: TanStack Start, built to a static `dist/`, hosted on Horizon.
- Desktop: Electron shell wrapping the hosted URL (no local DB).
- Backend: external customer-owned Supabase project
  `kjfjsfhftytezsjyegmb` (URL `https://kjfjsfhftytezsjyegmb.supabase.co`).
- Auth: Supabase email/password + Google OAuth.
- Authorization: `user_roles` + `has_role()` + RLS. Owner auto-assigned to
  `games48480@gmail.com` by trigger.

## Files in this folder

| File                            | Purpose                                         |
| ------------------------------- | ----------------------------------------------- |
| `OPTION_B_EXTERNAL_SUPABASE.md` | Master migration guide (start here).            |
| `option_b_schema.sql`           | Idempotent full schema — paste into SQL Editor. |
| `OWNER_SETUP.sql`               | Verify + assign owner role.                     |
| `ENV_TEMPLATE.txt`              | Env vars (publishable key only).                |
| `DEPLOY_WEB.md`                 | Build + upload to Horizon.                      |
| `BUILD_ELECTRON.md`             | Package desktop app per OS.                     |
| `PRODUCTION_CHECKLIST.md`       | Live-workflow verification.                     |

## Order of operations

1. Apply `option_b_schema.sql` in the Supabase SQL Editor.
2. Configure Auth providers + redirect URLs in the Supabase dashboard.
3. Deploy the web build per `DEPLOY_WEB.md`.
4. Owner signs up; run `OWNER_SETUP.sql` to confirm role.
5. Walk `PRODUCTION_CHECKLIST.md` end to end.
6. Package Electron per `BUILD_ELECTRON.md` and hand over the zip.

## Security guarantees

- Only the Supabase publishable key ships to the browser and the Electron
  package. RLS gates every row.
- `SUPABASE_SERVICE_ROLE_KEY` lives only in the host secret manager and is
  read only by server functions if/when needed. It is never in git, never
  in `dist/`, never in the Electron package.
- The Electron renderer runs with `contextIsolation: true`,
  `nodeIntegration: false`, `sandbox: true` — no Node access from page JS.

## Old project refs (deprecated)

- `pyvuiyzjabggnjbuvzsj` — old Lovable Cloud backend.
- `zbfbnwgbqydttsuuhmxn` — old dev Supabase.

Do not use either in production code, env files, or docs other than this
historical note.
