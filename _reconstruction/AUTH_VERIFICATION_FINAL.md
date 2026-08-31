# Authentication Verification — Final Evidence

**Date:** 2026-08-30  
**Supabase project:** `dqgrrafuoxaorvyrcuuh`  
**Live app:** https://aurum.arivahly.in  
**Deterministic script:** `scripts/verify-auth-final.mjs`  
**Machine evidence:** `_reconstruction/AUTH_VERIFICATION_FINAL.json`  
**Signup policy:** `_reconstruction/SIGNUP_POLICY_VERIFICATION.json` (10/10 PASS)

## Overall status

| Layer | Result |
|-------|--------|
| **Automated auth chain** | **PASS** (60/60 checks) |
| **Signup policy** | **PASS** (10/10) |
| **Owner live account (aritramanna222@gmail.com)** | **MANUAL** — owner browser login required |
| **Google OAuth full click-through** | **MANUAL** — wiring verified; invite→Google→callback needs owner browser |
| **OTP full delivery click-through** | **MANUAL** — route + policy verified; email delivery needs owner browser |

Security unchanged: no hard-coded roles/tenants, no bypassed RLS, no public signup.

---

## 1. Normal ERP user — PASS

**Account:** `mtj.qa.firm-owner.20260731@example.com`

| Step | Result |
|------|--------|
| Password auth | 200 |
| `get_authorization_context` | 200, active workspace `erp`, org `f9f73cce-…` |
| Default route | `/` (ERP home) |
| `resolve_subscription_access` | `granted`, `valid=true` |
| RLS org select | 200 |
| Token refresh → context stable | PASS |
| Logout → re-login → context stable | PASS |

**Browser (prior session):** login → `https://aurum.arivahly.in/app` dashboard.

---

## 2. Platform / SaaS owner — PASS (QA) + MANUAL (owner Gmail)

**QA account (real `saas_admin` in `user_roles`):** `mtj.qa.platform-admin.20260731@example.com`

| Step | Result |
|------|--------|
| Password auth | 200 |
| `get_authorization_context` | `is_platform_owner=true`, platform workspace present |
| Default route | `/platform` |
| `set_platform_workspace` | 200, active=`platform` |
| Token refresh / re-login | Context remains platform |
| **Live browser** | Login → **`/platform`** (not ERP, not `/request-access`) |

**Owner live account:** `aritramanna222@gmail.com` — same `saas_admin` role in DB; **must be confirmed by owner in browser** (password not in automation env). No fake session or hard-coded access used.

---

## 3. Customer portal — PASS

**Account:** `mtj.qa.customer.20260731@example.com`

| Step | Result |
|------|--------|
| Auth + context | Active workspace `customer` |
| Default route | `/customer-portal` |
| `get_my_portal_context` | 200 |
| Session refresh / re-login | PASS |

---

## 4. Karigar portal — PASS (auth) / entitlement note

**Account:** `portal.qa.karigar.a@ornexa.test`

| Step | Result |
|------|--------|
| Auth + context | Active workspace `karigar` |
| Default route | `/karigar-portal` |
| `get_my_portal_context` | **403** `feature_not_entitled:karigar_portal` |
| Session refresh / re-login | PASS |

**Interpretation:** Authentication and workspace routing are correct. Portal **data** RPC is blocked by firm plan entitlement — not an auth-chain failure. Enable `karigar_portal` feature for that QA firm to load portal data.

---

## 5. Supplier portal — PASS

**Account:** `portal.qa.supplier.a@ornexa.test`

| Step | Result |
|------|--------|
| Auth + context | Active workspace `supplier` |
| Default route | `/supplier-portal` |
| `get_my_portal_context` | 200 |
| Session refresh / re-login | PASS |

---

## 6. Google OAuth + OTP — wiring PASS, full flow MANUAL

**Verified deterministically:**
- `enable_signup = false` in `supabase/config.toml`
- Public signup rejected (422)
- `invite-accept` edge: `accept_oauth` + rate limit
- Client: `signInWithGoogle`, `/auth/callback`, `/otp-login`
- Aurum redirect URLs in config

**Not automated (requires owner browser + real Google/email):**
- Invitation → Google → callback → PKCE → invite validation → OTP → tenant link

Google alone cannot create accounts (signup disabled + invite server validation).

---

## 7. Session lifecycle — PASS

For ERP, platform QA, customer, karigar, supplier personas:
- Token refresh does **not** destroy workspace type
- Logout + password login restores same workspace shape

(Client intentionally ignores `TOKEN_REFRESHED` for full re-bootstrap — by design.)

---

## 8. Failure cases — PASS

| Case | Result |
|------|--------|
| Public signup | Rejected 422 |
| Wrong invitation code | `valid=false` |
| ERP user karigar portal context | No cross-portal bleed (erp active) |
| Trial/public provision RPC | Blocked |

---

## 9. Fixes applied (accepted)

- `20260830240000` — auth RPC read-only transaction
- `20260830250000` — `is_platform_operator` / `set_platform_workspace`
- `20260830260000` — infer active workspace when context empty
- Client — live auth context no longer stripped by `preferJewellerAuthorization`
- Production fetch throttle relaxed (not DB upgrade)

---

## 10. Remaining to close auth 100%

1. **Owner signs in** as `aritramanna222@gmail.com` → confirm lands on `/platform`
2. **One real invitation** → Google OAuth → callback → OTP (owner browser)
3. **Karigar portal data** (optional): enable `karigar_portal` entitlement on QA firm if portal UI data is required

After (1) and (2), authentication verification can be marked **fully closed**.
