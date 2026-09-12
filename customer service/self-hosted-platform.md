# AVS Gold ERP — Self-Hosted Platform Policy

**Prepared:** 2026-09-12 (Researchy)  
**Owner decision:** Platform stack must be **self-hosted** (Hostinger-first). **AI can be paid later.**

---

## 1. Principle

| Layer | Policy |
|-------|--------|
| Platform / SaaS control plane | **Self-host** on Hostinger (app, mail, support desk, workers) |
| Database / auth | Supabase = **auth + DB only** (free plan) — no mail, no support workers, no Edge Function mail loops |
| Storage / media | Cloudflare R2 / allowed object storage — do not hammer Supabase storage |
| Shop | `maatarajewellers.shop` — **never deploy over** without owner approval |
| AI (cloud) | **Pay later** — keep local/fallback AI; Cloud AI / paid widgets optional after platform is solid |

---

## 2. What “self-hosted platform” means for AVS

### Must stay on Hostinger / own infra

1. ERP app tip deploy → `erp.arivahly.in` (not shop)  
2. Outbound + inbound **email** (SMTP/IMAP) — Hostinger mailboxes  
3. **Support desk** — **Chatwoot Community Edition** on Hostinger VPS (not tawk/Crisp as SoT)  
4. Payment gateway PHP APIs already under `public/api/payments/` — Hostinger as source of truth for live ERP  
5. Webhooks / return URLs on `erp.arivahly.in`

### Explicitly demoted / optional

| Item | Status under this policy |
|------|---------------------------|
| **tawk.to** (hosted SaaS chat) | Optional temporary marketing widget only — **not** the platform support SoT. Prefer Chatwoot CE. |
| Crisp Free / Cloud | Do not choose as platform desk |
| Chatwoot Cloud Hacker | Do not use — free cloud lacks email inbox |
| Paid AI Assist (tawk / Crisp Hugo / Chatwoot Captain) | **Later** — after self-host desk works |
| Tenant Cloud AI credits | Product feature; not required for platform care |

---

## 3. Support desk (aligned to self-host)

**Canonical plan:**

1. **In-ERP:** `/help` + ConsumerSupportDesk + `/settings/support` (already credit-free)  
2. **SaaS ops desk:** Chatwoot CE on Hostinger VPS + `support@` IMAP/SMTP  
3. **Grok Bot:** drafts SAFE FAQ replies; escalates gold/finance/security — **0** tenant credit burn  
4. **AI paid add-ons:** deferred  

See also: `customer service.md` (updated for self-host preference).

Board: AVS-53 Chatwoot CE — Not started; AVS-52 tawk code may exist but is not required for self-host SoT.

---

## 4. Payments (platform billing)

SaaS Razorpay for license/credits stays on **Hostinger PHP** (`public/api/payments/`).  
LIVE held until owner greenlight (PAY-GW / AVS-34).  
Website policy pages must meet Razorpay activation rules — see `razorpay-partner-website.md`.

---

## 5. Implementer scope (from this policy)

- Prefer Chatwoot CE + Hostinger mail over any SaaS chat SoT  
- Do not add paid AI support products in this phase  
- Do not move support mail to Supabase  
- Keep secrets in Hostinger env / untracked `.env` only  

---

*Researchy · Owner direction 2026-09-12*
