# Security

## Secret handling — renderer never sees secrets

The WasenderAPI **Personal Access Token** (account/management) and **session API Key** (messaging) are stored **encrypted at rest** with Electron `safeStorage` (OS keychain / Windows DPAPI) in the main process (`electron/wasender.ts`). They are:

- decrypted only in the main process, only for the moment of an outbound HTTPS call;
- never returned to the renderer, never stored in the DB, never synced to the cloud;
- proxied through IPC (`wasender:set-token`, `wasender:set-apikey`, `wasender:request`) — the renderer can store/forget/use a secret but never read it back.

If the OS keychain is unavailable, a clearly-marked `plain:` blob is used so the feature still works, flagged as un-keyed to the user.

## Debug logging

WasenderAPI requests log `[wasender] METHOD url {payload,status,response}` to the main-process console for debugging — **never** including the token/API key.

## Cloud authorization

Supabase Row-Level Security governs every table. New tables require RLS policies in their migration. Branch scoping is applied on read (`useLedger.refresh` filters by `branchId` for non-global roles) and on write (`supabase-write.ts`).

## Audit trail

Financial postings (gold ledger, material vault, worker gold book) append to `security/audit-log.ts` with actor id/email, action, before/after. Best-effort — never blocks the operation, but every posting attempts it.

## Financial locks

Month-end-closed periods reject new postings (`assertPeriodOpen`). Disabling enforcement (`financialLockEnforcementEnabled`) is a deliberate, audited admin action.

## Roles

Route access is gated by `guardRoute` (`permissions.ts`) / `rbac.ts`. Global roles (Super Owner, Administrator, CEO View-Only) see all branches; others are branch-scoped.

## Data in project memory

Durable architecture decisions only. Never store credentials, tokens, or customer PII in project memory or docs.

## Artifacts / distribution

Do not publish or distribute anything imitating a real record, receipt, or organization. Generated PDFs sent over WhatsApp use short-TTL signed Storage URLs.
