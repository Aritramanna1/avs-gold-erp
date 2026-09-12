# 01 - What must be improved (full list)

**Date:** 2026-09-12 — Researchy  
**Sources:** Notion AVS-4 / AVS-49 / AVS-56 / AVS-58 / AVS-62 / PAY-GW / HANDOVER · live login smoke · owner self-host decision · **Testing live observe (777, 2026-09-12)**  

Ordered for operators first. Implementer uses this + stubs + create prompt.

**LIVE fact (Testing):** `erp.arivahly.in` v1.1.1 · firm 777 · AVS-4 **nav words already match** · **Stock opens on Gold** · rate chip still **NOT SET** · Home still **card grid** (no Gold today / Cash today blocks). LIVE ≠ tip until Hostinger pull of `main` (not shop).

---

## P0 - Blockers / top operator pain

| ID | Improvement | Why | Live status (777 observe) | Doc / stub |
|----|-------------|-----|---------------------------|------------|
| P0-1 | Hostinger pull `main` tip → erp.arivahly.in (not shop) | LIVE ≠ tip; tip fixes need pull | Keep awareness; this walk is LIVE | `stubs/ops-hostinger-pull.md` |
| P0-2 | Ship AVS-4 nav words: Home · Sell · Customers · Stock · Make · Money · Reports · More | Was Retail/MFG/Accounts jargon | **DONE on LIVE** — words match; remaining = density/icon+word polish + jargon *inside* modules | `stubs/ux-nav-shell.md` |
| P0-3 | Stock default = **Gold** (not Ready Stock) | Top IA miss for gold ERP | **DONE on LIVE** — Gold selected; Ready on tab; regression-watch after deploys | `stubs/ux-stock-gold-first.md` |
| P0-4 | Rate chip + "Set today's gold rate" one CTA | Missing rate kills selling | **OPEN** — chip shows GOLD RATE Rs. NOT SET; no one-tap Set CTA on chip/Home | `stubs/ux-rate-cta.md` |
| P0-5 | Home: Gold today then Cash + shortcuts Sell · Old gold · Give metal · Who owes · Day done | Operator ≤3 taps | **OPEN** — Daily operations card grid; Who owes / Give metal / Day done exist; **no** Gold/Cash today blocks | `stubs/ux-home.md` |
| P0-6 | Self-host Chatwoot CE + Hostinger support@ IMAP/SMTP | Platform support SoT; no SaaS chat SoT | Not in 777 walk | `stubs/support-chatwoot-ce.md` |
| P0-7 | Razorpay policy pages complete (About, Contact, Pricing, Terms, Privacy, Refunds, Shipping as required) | Needed for LIVE keys | Not in 777 walk | `stubs/razorpay-policy-pages.md` |

---

## P1 - Major product / platform

| ID | Improvement | Notes | Live status (777 observe) | Stub |
|----|-------------|-------|---------------------------|------|
| P1-1 | Credits copy → Credits left / Buy credits / Pay now | Ban Wallet/Top-Up jargon | Settings Billing already **Credits left / Buy credits**; add chrome **Credits left** chip so operators need not dig | `stubs/ux-credits-copy.md` |
| P1-2 | Attention bell + Needs attention (VIEW-only) | RATE/IRN/KARIGAR/EXCEPTION | Bell badge **1**; Home has Gold Rate Not Set card; ensure plain titles + one fix (rate first) | `stubs/ux-attention.md` |
| P1-3 | PAY-GW TEST callback `?payment=callback` wired; LIVE held | Hostinger PHP SoT | Not walked | `stubs/pay-gw-callback.md` |
| P1-4 | Grok Bot SAFE/ESCALATE triage routine | 0 credit burn | Not walked | `stubs/support-grok-triage.md` |
| P1-5 | AUTH-MAIL Hostinger SMTP after password rotate | Supabase auth only | Not walked | `stubs/ops-auth-mail.md` |
| P1-6 | Fix aurum SSL + portal DNS | Public widgets need sites up | Not walked | `stubs/ops-dns-ssl.md` |
| P1-7 | Owner Team / Settings access for firm Owner | SETTINGS-02 class | Owner opened Users & Roles + Business & Branches — **no Access Restricted** this pass; re-VERIFY after tip/LIVE sync | `stubs/ux-settings-owner.md` |
| P1-8 | Sell: one gold primary + scan/search-first | AVS-4 Sell sheet | Gold-first Billing yes; still **two** strong CTAs (+ Settlement + Invoice); POS F2 present; no dedicated missing-rate banner | (fold into Sell UX / AVS-4) |
| P1-9 | Customers: land on grahak with Gold bal \| Cash bal | Park Karigar under Make | People Directory still mixes Party/Karigar/Employee/Vendor; no bal header on landing | (fold into Customers UX) |
| P1-10 | Make: promote Give metal / Get back / Jobs | Over Workshop Cockpit / Receive Finished Product / Dhadi as primary | Manufacturing Books landing; Give metal on Home shortcuts; Meena/Dhadi still in sub-nav | (fold into Make UX) |
| P1-11 | Money: Cash \| Gold @995 with Who owes / Receipts first | Operator landing before vault exports | Lands on **Our Gold Stock** / vault; cash secondary; no mojibake seen | (fold into Money UX) |
| P1-12 | Reports: question-first operator hub | Over TRANSACTION>LEDGER suite chrome | Accounting & Statutory suite hub (jargon-first) | (fold into Reports UX) |

---

## P2 - Polish / later

| ID | Improvement | Live note | Stub |
|----|-------------|-----------|------|
| P2-1 | Look at piece / AI help / How we price gold plain verbs | Replace admin jargon (Accounting & Statutory, MCP/JSON-RPC on firm Settings Advanced, Dhadi as primary nav word) | `stubs/ux-plain-verbs.md` |
| P2-2 | Paid AI support add-ons (optional) - **after** self-host desk | — | `stubs/ai-pay-later.md` |
| P2-3 | Razorpay Technology Partner (sub-merchants) - later | — | `stubs/razorpay-tech-partner.md` |
| P2-4 | tawk only if temporary marketing stopgap - not SoT | — | `stubs/support-tawk-optional.md` |
| P2-5 | Mojibake / branding VERIFY on live after pull | None seen on walked screens this pass; re-VERIFY after next Hostinger pull | `stubs/qa-live-verify.md` |

---

## Hard "do not"

- Do not burn tenant credits for SaaS support  
- Do not auto-write gold/ledger/GST from bots  
- Do not invent tax/gold rates  
- Do not deploy over shop  
- Do not put support mail on Supabase  
- Do not switch Razorpay LIVE without owner greenlight  

---

## Testing input (folded 2026-09-12)

Source: `stubs/testing-live-observe.md` — Status: **Done** (firm 777, click UI only).

**Headline for Bug Fixer / Implementer**
1. Do **not** re-ship nav rename or Stock→Gold as if missing on LIVE — already match; regression-watch only.
2. **Ship next on tip → Hostinger:** P0-4 rate one-tap CTA; P0-5 Home Gold/Cash today blocks + five-shortcut strip.
3. Then P1 chrome Credits chip, Sell single primary, Customers/Make/Money/Reports landings per table above.
4. Ask Testing for re-VERIFY after each Hostinger pull — do not invent defects.

Full module walk + AVS-4 matrix: see the stub file (pre-auth through More/Settings).

Notion: Testing boarded **OPS — Testing live observe**. Related research: AVS-79 / parked UI research task as needed.