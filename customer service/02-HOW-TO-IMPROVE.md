# 02 — How to improve (playbook)

**Date:** 2026-09-12 · Researchy  

Use with `01-IMPROVEMENTS.md` and empty files in `stubs\`.

---

## Method

1. **Observe live** (Testing → `stubs/testing-live-observe.md`) — click UI only.  
2. **Compare** to locked AVS-4 + `00-PROJECT-SCOPE.md`.  
3. **Pick one P0 stub** — implementer fills stub then ships one small PR.  
4. **Hostinger pull** before claiming LIVE fixed.  
5. **VERIFY** on live as 777 (Testing) — still observe/verify, don't invent.

---

## Improvement themes

### A. Navigation and IA (operator literacy)

Target chrome: Home · Sell · Customers · Stock · Make · Money · Reports · More.  
Stock opens on **Gold**. Home shows **Gold today** before **Cash today**. One gold primary CTA. Icon + word ≥48px. Ban Day Book / Customer Ledger / Ready Stock / Tokens as primary labels.

Stubs: `ux-nav-shell`, `ux-stock-gold-first`, `ux-home`, `ux-rate-cta`, `ux-credits-copy`, `ux-attention`, `ux-plain-verbs`, `ux-settings-owner`.

### B. Customer care (self-host)

SoT desk = Chatwoot CE on Hostinger + support@ mail. Grok Bot drafts SAFE FAQ only. Zero tenant credit burn. AI paid add-ons later. tawk optional non-SoT.

Stubs: `support-chatwoot-ce`, `support-grok-triage`, `support-tawk-optional`, `ai-pay-later`.

### C. Payments / Razorpay website

Complete policy pages for LIVE activation. Keep TEST PAY-GW + callback wire. LIVE held. Technology Partner path later.

Stubs: `razorpay-policy-pages`, `pay-gw-callback`, `razorpay-tech-partner`.

### D. Ops

Hostinger pull, AUTH-MAIL, aurum SSL / portal DNS, live VERIFY.

Stubs: `ops-hostinger-pull`, `ops-auth-mail`, `ops-dns-ssl`, `qa-live-verify`.

---

## Create / fill workflow

Paste `prompts/IMPLEMENTER_CREATE_PROMPT.md` into the implementer agent.  
They fill every empty stub (except Testing's observe file while Testing is working).

---

## Definition of done (pack)

- [ ] Testing filled `testing-live-observe.md`  
- [ ] Implementer filled P0 stubs + linked PRs or blockers  
- [ ] Owner Hostinger pull + Razorpay policy URLs submitted when going LIVE  
- [ ] Chatwoot CE reachable for support@  
