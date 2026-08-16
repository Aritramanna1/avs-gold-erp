# Legacy Architecture Removal Report

## Executive Summary

This report records the retired legacy architecture that was removed, migrated, or intentionally retained in the Ornexa / AVS ERP codebase. The current authoritative runtime is the Supabase-online architecture: Supabase Auth, PostgreSQL, RLS, RPCs, storage, cloud workflow automation, and browser session memory only. No production path is authorized to rely on local SQLite, local-first sync, IndexedDB primary persistence, local auth, or hybrid-as-authoritative mode.

This document is the final compliance artifact required by the cleanup mandate. It distinguishes:

- Remove: obsolete architecture or implementation details that were retired.
- Migrate logic: valid business rules or functionality that were preserved in the new authoritative runtime.
- Keep: active architecture or code paths intentionally retained because they are still valid and non-authoritative.

## Source-of-Truth Standard

The active architecture standard for this repository is:

- Supabase PostgreSQL is the production data authority.
- Supabase Auth handles user authentication and session lifecycle.
- Supabase Row-Level Security enforces data access and tenant boundary rules.
- Supabase Storage is the authoritative document and asset store.
- Browser state is transient and non-authoritative.
- Historical alternative architectures remain only as archival context, not as runtime instructions.

## Remove

The following legacy architecture and patterns were removed from active production authority or explicitly deprecated as non-authoritative:

1. Local SQLite primary database authority
   - Legacy local database / sql.js patterns were retired.
   - Local-first persistence is not a production workflow.

2. Local-first / offline-first runtime
   - Any runtime path that expected to keep the business system authoritative while disconnected was retired.
   - Offline-first sync and local outbox logic were treated as historical only.

3. Hybrid mode as the production path
   - Hybrid runtime logic was retired as an authority model.
   - Any runtime that attempted to treat local and remote state as equivalent production truth was removed or neutralized.

4. IndexedDB / browser-local authoritative persistence
   - Browser storage was not allowed to be authoritative for ERP operational data.
   - Browser cache is now transient UI/session state only.

5. Local authentication / local account authority
   - Local user auth and local session authority were not approved for production.
   - Auth remains tied to Supabase Auth with the appropriate role scoping.

6. Local file-vault / local attachment authority
   - Legacy local vault or detached local storage patterns were retired.
   - Documents, attachments, and print assets now use the Supabase-backed model.

7. Legacy outbox synchronization concerns that implied local production data authority
   - pushPendingOutbox(), startSyncOutboxScheduler(), and similar compatibility surfaces were neutralized or reduced to no-op compatibility shims.

8. Contradictory production documentation and instructions
   - Older docs and build guidance that described local-first or hybrid modes were rewritten or explicitly marked historical.

## Migrate Logic

The following valid business logic, domain rules, historical knowledge, and workflow behaviors were preserved and migrated into the Supabase-online structure:

1. Gold ledger and financial movement logic
   - The ledger business rules were preserved in the authorized business logic layer, especially the ledger stores and report pipeline.
   - Movement semantics, enforcement, and balancing logic remain valid under the Supabase-backed model.

2. Manufacturing and workshop workflow logic
   - Production workflows, job cards, stock movement logic, workshop bookkeeping, and operational rule engines were retained in the modern runtime.
   - These rules were not discarded; they were aligned to the online data authority.

3. Reporting and document generation logic
   - Print, PDF, report, and document-generation capabilities were retained.
   - Legacy duplicate generators were not allowed to remain as active production sources of truth.

4. Security and RBAC logic
   - Security rules, role-based access, login/session controls, and audit-pattern expectations were retained and enforced in the Supabase-backed platform.

5. Historical business metadata and migration knowledge
   - Older operational documentation, repair migration logic, and business rules were retained as historical references where they support migration or audit fidelity.
   - These materials were not used as active runtime instructions.

6. Attachment and storage migration awareness
   - Legacy attachment references and migration paths were retained only to support a safe transition from older metadata shapes into the active Supabase Storage architecture.

## Keep

The following items were intentionally retained because they remain valid in the current architecture and are not obsolete:

1. Supabase-backed data layer
   - `src/integrations/supabase/client.ts`
   - providers and repository access patterns
   - RLS-aware query and write flows

2. Current runtime architecture policy and docs
   - `README.md`
   - `INSTALLATION.md`
   - `USER_GUIDE.md`
   - `CLAUDE.md`
   - `CONTRIBUTING.md`
   - `docs/ARCHITECTURE.md`

3. Compatibility shims intended to preserve public API stability
   - `src/lib/sync-engine.ts` remains as a compatibility stub that explicitly states the old background sync model is no longer used.
   - This is a compatibility layer, not an active authority path.

4. Current business runtime stores
   - `src/lib/ledger-store.ts`
   - `src/lib/stock-store.ts`
   - `src/lib/orders-store.ts`
   - `src/lib/billing-store.ts`
   - and similar stores remain active because they implement the approved runtime business logic against the live Supabase data model.

5. Historical documentation explicitly archived as superseded
   - `docs/OFFLINE_MODE_GUIDE.md`
   - `docs/HYBRID_SETUP.md`
   - older pilot-era test/security references

   These remain available for migration and historical context, but they must not be used as active implementation guidance.

## Classification Summary

| Category | Outcome |
| --- | --- |
| Local SQLite authority | Remove |
| Local-first / offline-first runtime | Remove |
| Hybrid-as-authoritative mode | Remove |
| IndexedDB primary persistence | Remove |
| Local auth / local user authority | Remove |
| Local vault / local attachment authority | Remove |
| Gold ledger business rules | Migrate logic |
| Workshop and manufacturing workflow rules | Migrate logic |
| Reporting / print / document capability | Migrate logic |
| RLS / RBAC / Supabase Auth enforcement | Keep |
| Compatibility shims and explicit archival notes | Keep |

## Verification Notes

The repository was reviewed for contradictory operational guidance. The active architecture now clearly states that Supabase-online is the sole authoritative design. Remaining references to historical offline/hybrid models are preserved only as clearly labeled retired or archival notes rather than production instructions.

No production path is considered complete while any active path still implies local-authoritative or hybrid-authoritative operation.

## Final Compliance Statement

The legacy architecture has been retired from active production authority. Valid business logic was preserved and migrated into the Supabase-backed architecture. Historical records remain only as superseded design context. This repository now aligns with the approved single-source cloud ERP operating model.
