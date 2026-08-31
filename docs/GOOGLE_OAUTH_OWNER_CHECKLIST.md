# Google OAuth — Product Owner Checklist (your action)

Ornexa **keeps** Google OAuth. These steps are **only in your hands** (Google Cloud + Supabase Dashboard). The app already shows the button when `VITE_GOOGLE_OAUTH_ENABLED=true`.

## Aurum hosts (CVsE73i6 — deploy surfaces)

Add these **in addition** to shop URLs when deploying Aurum triple-dist:

| Surface | Site URL | Redirect URLs |
|---------|----------|---------------|
| Marketing | `https://aurum.arivahly.in` | `/auth/callback`, `/verify`, `/doc/*` |
| ERP | `https://erp.aurum.arivahly.in` (live Hostinger vhost; `aurum.erp.*` alias when DNS added) | `/auth/callback`, `/login`, `/trial/start` |
| Portal | `https://aurumportal.arivahly.in` | `/auth/callback`, `/invite/accept` |

Env templates: `.env.production.marketing.example`, `.env.production.erp.example`, `.env.production.portal.example`

---

## Current test domain

**`https://maatarajewellers.shop`**

When you buy the new Ornexa domain, repeat the same steps with the new URL and update `VITE_PUBLIC_APP_URL` at build time.

---

## 1. Google Cloud Console

1. Open [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials.
2. Create or edit **OAuth 2.0 Client ID** (Web application).
3. **Authorized JavaScript origins:**
   - `https://aurum.arivahly.in`
   - `https://erp.aurum.arivahly.in`
   - `https://aurumportal.arivahly.in`
   - `https://maatarajewellers.shop` (legacy shop — do not use for new Aurum deploys)
   - `https://avs-erp-preview-20260806.hostingersite.com` (staging, optional)
4. **Authorized redirect URIs** (Supabase handles OAuth — add Supabase callback):
   - `https://<YOUR_SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback`
   - Find project ref in Supabase → Settings → API (e.g. `dqgrrafuoxaorvyrcuuh`).
5. Copy **Client ID** and **Client Secret**.

---

## 2. Supabase Dashboard

1. **Authentication → Providers → Google** → Enable.
2. Paste Client ID and Client Secret.
3. **Authentication → URL Configuration:**
   - **Site URL:** `https://maatarajewellers.shop`
   - **Redirect URLs** (add all):
     - `https://maatarajewellers.shop/auth/callback`
     - `https://maatarajewellers.shop/trial/start`
     - `https://maatarajewellers.shop/**` (wildcard if supported)
     - Staging preview URL if used

---

## 3. Verify (5 minutes)

| Step | URL | Expected |
|------|-----|----------|
| Login | `/login` | “Continue with Google” visible |
| Trial | `/trial/start` | Google signup works |
| After sign-in | `/app` or `/platform` | Correct workspace (not wrong portal) |

If you see `provider is not enabled` → Supabase Google provider not saved.  
If you see `redirect_uri_mismatch` → fix Google Cloud redirect URI to Supabase callback.

---

## 4. Do NOT

- Remove Google OAuth from the codebase to “fix” errors.
- Use production Google credentials on localhost without adding `http://localhost:5173` to origins.

---

**Email/password login remains available.** Google is an additional method only.
