# MTJ ERP — Production Verification Checklist

Run this AFTER `docs/option_b_schema.sql` has been applied to project
`kjfjsfhftytezsjyegmb` and the owner has signed up.

## Pre-flight

- [ ] `.env` populated from `.env.example` (publishable key only, no service role)
- [ ] Web build deployed to Horizon (or running locally via `bun run dev`)
- [ ] Owner role confirmed via `docs/OWNER_SETUP.sql`
- [ ] No occurrences of `pyvuiyzjabggnjbuvzsj` in `dist/` (`rg pyvuiyzjabggnjbuvzsj dist/` returns nothing)
- [ ] No occurrences of `SUPABASE_SERVICE_ROLE_KEY` in `dist/` or `electron-app/release/`

## Live workflow (sign in as owner)

- [ ] Login (email/password + Google)
- [ ] Create a Customer (people, type=customer) — reload page, row persists
- [ ] Create a Karigar (people, type=karigar) — reload, persists
- [ ] Create an Order — reload, persists
- [ ] Create a Job Card against the order — reload, persists
- [ ] Issue Gold to karigar (gold_ledger movement, worker_transactions row)
- [ ] Receive Work from karigar (return movement, job_process_steps updated)
- [ ] Stock entry (inventory + stock_movements)
- [ ] Create an Invoice — reload, persists
- [ ] Create a Payment against the invoice — reload, persists, customer_ledger updated
- [ ] Print Invoice opens print dialog with QR code
- [ ] QR Verify route loads the invoice from Supabase
- [ ] Daily Close runs without error and writes daily_close row
- [ ] Settings → Backup / Export produces a downloadable file
- [ ] Settings → Sync Status shows green for invoices + payments
- [ ] Gold Balance Sheet shows BALANCED

## RBAC spot-check

- [ ] Sign in as a `viewer` user → cannot create/edit/delete billing items
- [ ] Sign out → `/billing/*` redirects to `/auth`
- [ ] Anon (incognito) cannot reach any ERP route

## Sign-off

- [ ] All boxes above ticked → app is production-ready
