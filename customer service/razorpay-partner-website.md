# Razorpay — Terms, Partner Path & Website Requirements (AVS / Arivahly)

**Prepared:** 2026-09-12 (Researchy)  
**Scope:** Platform SaaS billing (license / credits) + future Technology Partner path for jewellery ERP tenants.  
**Related Notion:** PAY-GW AVS-34 (hold LIVE)  
**Local tip:** `C:\final erp 29.08\new and final`

**Not legal advice.** Re-check Razorpay Dashboard + linked T&Cs before LIVE. No secrets in this file.

---

## 1. Two different Razorpay modes for AVS

| Mode | What it is | When AVS needs it |
|------|------------|-------------------|
| **A. Merchant (SaaS billing)** | Arivahly/AVS collects money for licenses, Ornexa credits, invoices via one Razorpay account | **Now** — PAY-GW (TEST stubs OK; LIVE held) |
| **B. Technology Partner** | Platform/marketplace refers or embeds Razorpay for **sub-merchants** (tenant jewellers) and can earn commissions / use Embedded Payments | **Later** — only if tenants accept cards on *their* storefronts through your platform |

Do **not** confuse Mode B with firm POS jewellery checkout unless product explicitly scopes it.

Official partner overview: https://razorpay.com/docs/partners/technology-partners/  
Partner program overview: https://razorpay.com/docs/partners  

---

## 2. Merchant website requirements (for LIVE keys)

Official doc: https://razorpay.com/docs/payments/dashboard/account-settings/business-website-details/

### Why it matters

Without approved live website/app details you **cannot get live mode API keys** and cannot accept payments from website/app.  
You can still use **Invoices** and **Payment Links** from the Dashboard without that.

### Pages Razorpay expects (submit URLs in Dashboard)

From Razorpay “Business Website Details” (India docs):

**Handy tips / ensure available:**

1. Terms and Conditions  
2. Privacy Policy  
3. Shipping Policy  
4. Contact Us  
5. Cancellation and Refunds  

**When updating a website, submit links for:**

- About us  
- Contact us  
- Pricing details  
- Terms and conditions  
- Privacy policy  
- Refunds / Cancellation & Refund policy  

Also typically required in the flow:

- Live **Website URL**  
- **Sample invoice** upload (PNG/JPG/PDF)  
- Answer: does payment require login? If yes → test credentials; if no → select that option  

### Additional websites

- One main + up to **five** additional websites (e-commerce category)  
- Additional sites need reason (≥50 words) + same policy links + sample invoice  
- Primary site: instant checks; additional: manual review  

### Dashboard path

Account & Settings → Website and app settings → Business website detail → Add / Edit.

### Practical AVS checklist (erp.arivahly.in / marketing)

| Page | Suggested live URL (implementer to confirm real routes) | Notes |
|------|----------------------------------------------------------|-------|
| About us | Marketing / About | AVS branding — not Ornexa leftovers |
| Contact us | Contact + working email/phone/address | Prefer Hostinger mailbox |
| Pricing | SaaS plans / credits pricing | Clear INR; no invented prices |
| Terms | `/terms` (or Terms of Service) | Already on login footer |
| Privacy | `/privacy` | BUG-014/015 mojibake fix shipped — verify live after Hostinger pull |
| Refunds / Cancellation | Dedicated refunds page | Must include **clear timelines** (e.g. 5–7 business days) |
| Shipping | If selling physical goods via that domain | SaaS-only may use “N/A / digital delivery” wording Razorpay accepts — confirm in Dashboard prompts |

**HTTPS** with valid cert. Policies linked from footer / checkout.  
Do not paste LIVE keys into chat or Notion.

Website Terms of Use (Razorpay.com itself — informational): https://razorpay.com/terms/  
Merchant service terms: select Payments under https://razorpay.com/tnc/ (Group Entity–specific).

---

## 3. Security rules Razorpay docs emphasize (implementer)

From Razorpay LLM docs index (https://razorpay.com/docs/llms.txt):

1. **Server-side Order creation** only — never create orders only in the browser  
2. **HMAC SHA256 signature verification** on payment success — mandatory  
3. Keys: TEST vs LIVE separated; LIVE gated (matches AVS PAY-GW hold)  

AVS already has Hostinger PHP under `public/api/payments/` and Platform Razorpay config UI — keep Hostinger as SoT for live ERP.

---

## 4. Technology Partner path (platforms & marketplaces)

Official: https://razorpay.com/docs/partners/technology-partners/

### Who it’s for

Marketplace/platform connecting buyers with sellers — e.g. AVS tenants who want Razorpay via Arivahly.

### Steps (Razorpay)

1. Create Partner account → request switch to **Technology Partner**  
2. Complete Partner **KYC**  
3. Integrate via **Razorpay OAuth** for sub-merchants  
4. Test with sample sub-merchant  
5. Go live  

Optional: **Embedded Payments** — onboard businesses, process payments, control fund flow from within platform.

### Partner application website field

When creating a Partner OAuth application, Razorpay asks for:

- Application **name** (shown on authorisation UI)  
- Application **website URL**  
- Optional **logo**  

Sub-merchant OAuth: only the person with sub-merchant credentials can authorise; redirect_url must point to your app.

Docs: https://razorpay.com/docs/partners/technology-partners/onboard-businesses/integrate-oauth/  

### AVS product decision (research recommendation)

| Decision | Recommendation |
|----------|----------------|
| Phase 1 (now) | Mode A only — Arivahly merchant account for SaaS credits/license. Finish website policy pages + TEST PAY-GW. Hold LIVE. |
| Phase 2 (later) | Evaluate Technology Partner if tenants need in-platform card acceptance. Requires Partner KYC + OAuth + legal review. |
| Out of scope now | Firm jewellery POS card rails unless separately boarded |

---

## 5. Gaps vs current AVS tip (from PAY-GW Notion)

Already present: PlatformRazorpayConfig, Checkout modal, Hostinger PHP create-order/callback/webhook, stub TEST path.  

Gaps implementer should close (TEST only until greenlight):

1. Wire `?payment=callback` / return_url end-to-end → `verifyPaymentCallback`  
2. 222 can save TEST return_url + webhook_url on live after Hostinger pull  
3. LIVE mode stays gated (`confirm_switch`)  
4. Public policy pages complete for Razorpay website review  

---

## 6. Sources (fetched / official 2026-09-12)

- Business Website Details: https://razorpay.com/docs/payments/dashboard/account-settings/business-website-details/  
- Technology Partners: https://razorpay.com/docs/partners/technology-partners/  
- Partners overview: https://razorpay.com/docs/partners  
- Website Terms of Use: https://razorpay.com/terms/  
- Merchant T&C hub: https://razorpay.com/tnc/  
- Docs LLM index: https://razorpay.com/docs/llms.txt  
- KYC by business type: https://razorpay.com/docs/payments/business-types-kyc-documents  

---

*Researchy · Align PAY-GW hold LIVE · No invented fees*
