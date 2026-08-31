# Public Signup Removal — Implementation Record (2026-08-30)

## Production inspection (before change)

| Path | Permitted public signup/trial? |
|------|--------------------------------|
| `/trial/start` UI | **Yes** — `signUp`, Google OAuth, company form |
| Edge `public-trial-provision` | **Yes** — authenticated POST → `provision_public_trial` |
| RPC `provision_public_trial` | **Yes** — `GRANT EXECUTE TO authenticated` |
| RPC `get_platform_trial_days` | **Yes** — callable pre-auth for trial UI |
| `/invite/accept` + `invite-accept` edge | **No new tenant** — joins existing firm (authorized) |
| Edge `onboard-tenant` | **Admin only** — `saas_admin` creates tenant + owner invite |

**No `/signup` or `/register` routes existed.** All public firm creation was the 14-day trial funnel.

## Changes (editable source — not production-direct)

### Backend
- `supabase/migrations/20260830220000_disable_public_trial_signup.sql`
  - `provision_public_trial` raises exception; REVOKED from `authenticated`
  - `get_platform_trial_days()` returns `0`; REVOKED from `anon`
  - `check_invite_accept_rate_limit` for invite validate/accept (25/min per email+action)
- `supabase/functions/public-trial-provision/index.ts` — always **403** `PUBLIC_SIGNUP_DISABLED`
- `supabase/functions/invite-accept/index.ts` — rate limit before validate/accept

### Frontend
- `/trial/start` → redirect to `/request-access` (no `signUp`, no provisioning)
- New `/request-access` — Request Access, Sign In, Accept invitation, Contact Support
- Marketing/login/auth CTAs: trial → request access / contact / sign in
- `free_trial_cta` default **false**
- Auth gate: users without workspace → `/request-access` (not trial)
- `resolvePortalOrTrialRoute` → `/request-access` kind `access`

### Existing flows preserved
- **Login** → session → firm resolution → dashboard
- **Staff/portal invite** → `/invite/accept` → edge validation → account + tenant link
- **Platform owner** → `onboard-tenant` (unchanged)

## Verification checklist

| # | Requirement | Evidence |
|---|-------------|----------|
| 1 | Public signup impossible | No `signUp` on public routes; edge 403; RPC revoked; Auth `/signup` → **422** |
| 2 | Trial creation impossible | `provision_public_trial` raises; `get_platform_trial_days` = 0 |
| 3 | Unauthorized account creation rejected | Migration + edge function + Auth `enable_signup = false` |
| 4 | Valid secure invitations work | `invite-accept` validate reachable (200); rate-limited |
| 5 | OTP verification works | `/otp-login`, invite password flow unchanged |
| 6 | New account linked to correct tenant | Invite edge assigns firm/portal (existing) |
| 7 | Existing users login normally | E2E sign-in PASS; workspace membership confirmed |

## Closure (2026-08-30)

**Applied**
- Migration `20260830220000_disable_public_trial_signup.sql` (linked project)
- Migration `20260830230000_fix_provision_public_trial_overload.sql` (overload fix)
- Edge functions deployed: `public-trial-provision` (v7), `invite-accept` (v20)
- Auth config pushed: `[auth] enable_signup = false` (production URLs preserved)

**Live verification** — `node scripts/verify-signup-policy-closure.mjs` → **10/10 PASS**

Evidence: `_reconstruction/SIGNUP_POLICY_VERIFICATION.json`

| Check | Result |
|-------|--------|
| Edge `public-trial-provision` → 403 | PASS |
| Edge `invite-accept` validate | PASS |
| Route `/trial/start` → `/request-access`, no signUp | PASS |
| RPC `provision_public_trial` anon blocked | PASS |
| RPC `provision_public_trial` authed blocked | PASS |
| Edge trial provision authed → 403 | PASS |
| Invite Google OAuth + rate limit wired | PASS |
| Existing user sign-in + workspace | PASS |
| Auth provider public signup disabled | PASS (422) |

**Policy enforced:** NO public signup · NO public 14-day trial · NO arbitrary Google/tenant creation · invitation-only account creation.

## Egress measurement

Unchanged — still requires owner controlled login for `window.__ORNEXA_EGRESS__.loginSummary()`.
