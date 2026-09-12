# P1-5: Custom SMTP Mail Delivery via Hostinger for Auth & Alerts (AUTH-MAIL)

## Goal
Route all authentication emails (password resets, team invitations, email verification) and system alerts through **Hostinger Custom SMTP** (`smtp.hostinger.com`) instead of the default Supabase built-in mailing service. Ensure high deliverability with strict SPF, DKIM, and DMARC alignment under `arivahly.in`, while respecting the self-hosted platform policy: **Supabase is reserved strictly for Auth & Database logic, not email relay**.

## Current tip evidence (paths)
- **Platform Architecture Policy**: [`customer service/self-hosted-platform.md`](file:///c:/final%20erp%2029.08/new%20and%20final/customer%20service/self-hosted-platform.md)
  - Section 1 & 2: Supabase = auth + DB only; outbound/inbound mail hosted on Hostinger.
- **Hostinger Email Configuration Helper**: [`public/api/config.php`](file:///c:/final%20erp%2029.08/new%20and%20final/public/api/config.php)
  - Configures Hostinger SMTP parameters for PHP-driven notifications.
- **Email Config Store**: [`src/stores/email-config-store.ts`](file:///c:/final%20erp%2029.08/new%20and%20final/src/stores/email-config-store.ts)
  - Manages tenant and platform mail delivery profiles.
- **Invitation & Password Reset Routes**:
  - Reset Password: [`src/routes/reset-password.tsx`](file:///c:/final%20erp%2029.08/new%20and%20final/src/routes/reset-password.tsx)
  - Accept Invitation: [`src/routes/accept-invitation.tsx`](file:///c:/final%20erp%2029.08/new%20and%20final/src/routes/accept-invitation.tsx)

## Changes (files / migrations / Hostinger)
1. **Supabase Auth Custom SMTP Settings**:
   - Navigate to Supabase Project Dashboard &rarr; **Authentication** &rarr; **SMTP Settings**:
     - Enable Custom SMTP: `True`
     - Sender Email: `auth@arivahly.in` (or `noreply@arivahly.in`)
     - Sender Name: `AVS Gold ERP`
     - Host: `smtp.hostinger.com`
     - Port: `465` (SSL) or `587` (TLS)
     - Username: `auth@arivahly.in`
     - Password: Hostinger rotated mailbox password (injected via secrets vault, never in git)
2. **DNS Record Verification**:
   - Hostinger DNS zone for `arivahly.in`:
     - SPF TXT: `v=spf1 include:_spf.mail.hostinger.com ~all`
     - DKIM TXT: Hostinger verified selector key
     - DMARC TXT: `v=DMARC1; p=none; sp=none; rua=mailto:dmarc-reports@arivahly.in`
3. **Application Verification**:
   - Test password reset trigger from `/forgot-password` and verify delivery headers confirm origin via `smtp.hostinger.com`.

## Acceptance
- User password reset emails arrive in recipient inboxes within 30 seconds with 0 spam flagging.
- Sender address correctly reflects `AVS Gold ERP <auth@arivahly.in>`.
- SPF and DKIM signatures pass validation in recipient mail headers.
- Supabase free default email rate limit is bypassed by using custom SMTP credentials.

## Out of scope
- Hardcoding SMTP credentials in `.env.example`, client-side code, or public repositories.
- Moving transactional customer support email processing into Supabase Edge Functions.

## Status: In progress (Awaiting owner SMTP password input in Supabase Dashboard)
