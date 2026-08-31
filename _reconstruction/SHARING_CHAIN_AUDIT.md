# Sharing / WhatsApp chain audit

**Date:** 2026-08-30  
**Scope:** Phase 7c — configurable providers, no renderer secrets, manual fallback

## Chain model

`Document → Share action → comm platform → provider (Wasender/Meta/email/SMS) → user confirm → logged result`

## Entry points (source)

| Surface | File | Provider path |
|---------|------|---------------|
| Invoice share | `src/lib/comm/send-whatsapp-document.ts` | Edge `send-whatsapp` / mode router |
| Document portal link | `src/lib/document-shares.ts` | Public `/doc/:token` via `resolve_document_share` RPC |
| Billing comm actions | `src/lib/doc-comm-actions.ts` | Comm request queue |
| WhatsApp settings | `src/routes/whatsapp.tsx` | Tenant config only — no secrets in bundle |

## Rules verified in source

| Rule | Status |
|------|--------|
| Secrets not in renderer | WORKS — `qa/unit/sharing-chain.test.ts` |
| WhatsApp not sole provider | PARTIAL — email/SMS routes exist; UI still WhatsApp-heavy |
| Manual/deep-link fallback when unconfigured | WORKS — `openWhatsAppDocumentDeepLink` in send chain |
| Plan entitlements | PARTIAL — document hosting gated; not all share paths |
| Audit logging | PARTIAL — comm inbox; not all doc types traced |

**Automated:** `qa/unit/sharing-chain.test.ts` (5 tests)

## Gaps (honest)

- Live provider send not re-verified on prod (Playwright moratorium)
- KYC public share blocked by policy — OTP portal path open
- Report share/export uses export engine; WhatsApp chain varies by report

## Next verification (non-Playwright)

- Unit: `document-shares` retention + RPC contract
- Script: grep comm actions on invoice/quote/estimate/receipt/settlement routes
- Manual once: configured Wasender tenant → invoice share → inbox row
