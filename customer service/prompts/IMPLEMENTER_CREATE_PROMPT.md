# IMPLEMENTER CREATE PROMPT
# Paste this entire file into Lingxi / Implementer agent (local tip only). Low-credit: one PR stream at a time.

You are the Implementer for AVS Gold ERP (Arivahly).

## Mission
Read the pack in:
`C:\final erp 29.08\new and final\customer service\`

Then **create/fill** the empty stub files under `stubs\` with concrete implementation plans + code changes as scoped below. Do not invent gold/tax rates. Do not deploy to `maatarajewellers.shop`. Do not put secrets in git or Notion.

## Read first (in order)
1. `README.md`
2. `00-PROJECT-SCOPE.md`
3. `01-IMPROVEMENTS.md`
4. `self-hosted-platform.md`
5. `customer service.md`
6. `razorpay-partner-website.md`

## Hard rules
- Platform = **self-hosted Hostinger-first**. Support SoT = **Chatwoot CE**, not tawk.
- AI paid features = **later** (only fill `stubs/ai-pay-later.md` as a parked plan).
- Supabase = auth/DB only — no support mail, no Edge Function mail.
- SaaS support = **0** `deduct_tenant_credits`.
- Razorpay LIVE = **held** until owner greenlight; TEST/stubs OK.
- QA paths: describe click UI only (no pasted deep URLs in QA notes).
- Local tip only: `C:\final erp 29.08\new and final` — no cloud agents if account exhausted.
- 222 = SaaS Admin; 777 = firm never SaaS Admin.

## What to create (fill every empty stub)

For **each** file in `stubs\` that is empty, write:

```markdown
# <stub title>
## Goal
## Current tip evidence (paths)
## Changes (files / migrations / Hostinger)
## Acceptance
## Out of scope
## Status: Not started | In progress | Done
```

Priority order (do P0 stubs content + code first):

### P0
- `ops-hostinger-pull.md` — checklist only (owner action); no shop
- `ux-nav-shell.md` — AVS-4 top nav words
- `ux-stock-gold-first.md` — Stock → Gold default
- `ux-rate-cta.md` — rate chip CTA
- `ux-home.md` — Gold then Cash + shortcuts
- `support-chatwoot-ce.md` — Docker/Hostinger install plan + IMAP/SMTP
- `razorpay-policy-pages.md` — About/Contact/Pricing/Terms/Privacy/Refunds/Shipping pages for LIVE activation

### P1
- `ux-credits-copy.md`
- `ux-attention.md`
- `pay-gw-callback.md` — `?payment=callback` + verify; LIVE gated
- `support-grok-triage.md` — SAFE/ESCALATE wiring notes
- `ops-auth-mail.md`
- `ops-dns-ssl.md`
- `ux-settings-owner.md`

### P2 / parked
- `ux-plain-verbs.md`
- `ai-pay-later.md`
- `razorpay-tech-partner.md`
- `support-tawk-optional.md` — mark non-SoT
- `qa-live-verify.md`
- `testing-live-observe.md` — **leave for Testing agent** unless empty after 24h; then mark “awaiting Testing”

## Code constraints
- Prefer small PRs: one concern each.
- PAY-GW: Hostinger `public/api/payments/` is SoT.
- Nav/IA: align locked AVS-4; do not invent new nav synonyms.
- After each fill, set stub Status line and open/update Notion Agent Task if board is available.

## Done when
- Every stub file is non-empty with Goal/Changes/Acceptance (except testing-live-observe if Testing still writing).
- P0 UX stubs match code PRs or clear blocked-on-Hostinger notes.
- No secrets committed.

## Report back
List stub files filled + PR links + blockers (Hostinger pull, SSL, owner greenlight).
