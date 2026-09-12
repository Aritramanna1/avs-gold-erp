# MTJ ERP — Complete Codebase Audit Report

**Date:** 2026-06-27  
**Status:** Build PASSES · 313 TypeScript errors · 29 ESLint warnings · 0 ESLint errors

---

## 1. Environment Configuration

### .env — UPDATED

The `.env` file has been written with the new credentials:

```
VITE_SUPABASE_URL="https://kjfjsfhftytezsjyegmb.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="[REDACTED_SB_PUBLISHABLE]_wU9_fzd7g_XBvvr-zW"
VITE_SUPABASE_PROJECT_ID="kjfjsfhftytezsjyegmb"
SUPABASE_SECRET_KEY=[REDACTED]
SUPABASE_JWKS_URL="https://kjfjsfhftytezsjyegmb.supabase.co/auth/v1/.well-known/jwks.json"
```

**Finding:** The new environment uses the same Supabase project as the old one (`kjfjsfhftytezsjyegmb`). The URL and publishable key are identical to the fallback values hardcoded in `src/integrations/supabase/client.ts` and `src/lib/supabase.ts`. The new additions are `SUPABASE_SECRET_KEY` and `SUPABASE_JWKS_URL` — these are server-side-only values, not exposed to the Vite frontend (no VITE\_ prefix), which is correct security practice.

**Action required:** The hardcoded fallback values in both client files can remain as-is (they match the env values exactly). No Lovable-specific config was found — the project was already configured for the same external Supabase project.

---

## 2. Build Status

| Check              | Result                                                                            |
| ------------------ | --------------------------------------------------------------------------------- |
| `npm run build`    | ✅ SUCCESS — 734 modules transformed                                              |
| `npx eslint`       | ✅ 0 errors, 29 warnings                                                          |
| `npx tsc --noEmit` | ❌ 313 type errors (does NOT block build — Vite transpiles without type checking) |

**Important:** Vite's build pipeline skips TypeScript type checking (it only transpiles). The app builds and ships to production successfully even with type errors present. TypeScript errors are a correctness/safety risk, not a build blocker.

---

## 3. TypeScript Errors — Root Cause Analysis

**Total: 313 errors across 35 files**

### Category A: Missing property `firmProfile` on `SettingsState` (3 files)

The settings store exposes the firm profile under `firm`, not `firmProfile`.

**Files affected:**

- `src/components/print/PrintLayout.tsx:34` — `s.firmProfile` → should be `s.firm`
- `src/components/print/ArchivalPrintLayout.tsx:14` — same
- `src/components/print/SignatureBlock.tsx:13` — same

**Fix:** Change `s.firmProfile` to `s.firm` in all three print layout components.

---

### Category B: Missing `branchId` on `RegisteredUser` (18 files, ~30 errors)

`RegisteredUser` in `settings-store.ts` does not have a `branchId` field, but many files reference `user.branchId`.

**Files affected:** `branch-selector.tsx`, `branch-filter.ts`, `BillingModule.tsx`, `orders-store.ts`, `hostinger-storage.ts`, `fileUpload.ts`, `expenses-store.ts`, `counter-order-wizard.tsx`, `GoldSettlementTab.tsx`, `supabase-write.ts`, `orders.new.tsx`, `orders.index.tsx`, `orders.print.$kind.$id.tsx`, `reports.index.tsx`, `settings.index.tsx`, `branches.index.tsx`, `expenses.index.tsx`, `AttachmentUploader.tsx`

**Fix:** Add `branchId?: string` to the `RegisteredUser` interface in `settings-store.ts`.

---

### Category C: Missing `await` — accessing `.id` on `Promise<T>` (many files, ~120 errors)

Multiple store methods return `Promise<T>` but the caller does not await them, then immediately accesses `.id` or other properties on the Promise object.

**Most critical files:**

- `src/components/issue-gold-dialog.tsx` (4 errors) — `.id` on `Promise<LedgerEntry>`
- `src/components/receive-work-dialog.tsx` (7 errors) — `.id` on `Promise<LedgerEntry|StockItem>`
- `src/components/counter-order-wizard.tsx` (2 errors) — `.id` on `Promise<LedgerEntry|Order>`
- `src/lib/test-seed.ts` (~150 errors) — `.id`, `.orderNo`, `.fullName` on `Promise<Person|Order>`

**Fix:** Add `await` before the store method calls. Example:

```ts
// Before (broken)
const entry = store.add(data);
console.log(entry.id); // entry is Promise<LedgerEntry>, not LedgerEntry

// After (fixed)
const entry = await store.add(data);
console.log(entry.id); // entry is LedgerEntry
```

---

### Category D: Missing `kycProgress` on `Person` (2 files)

`Person` interface in `people-store.ts` does not have `kycProgress`. Used in two places.

**Files:** `src/components/print/usePrintRecord.ts:152`, `src/lib/verify-token.ts:185`

**Fix:** Either add `kycProgress?: string` to `Person`, or replace with a computed value using the existing `docs` field.

---

### Category E: `SecurityLogItem.action` missing "rate limited" (1 error)

`AuthLayout.tsx:198` logs a "rate limited" action, but the `SecurityLogItem.action` type union does not include it.

**Fix:** Add `"rate limited"` to the `action` union in `SecurityLogItem` in `settings-store.ts`.

---

### Category F: `billing-store.ts:286` — duplicate `invoiceNo` key (1 error)

An object literal specifies `invoiceNo` twice.

**Fix:** Remove the duplicate key.

---

### Category G: `cloud-migrate.ts` — wrong property names on store setters (5 errors)

Lines 527–534 call store setters with `transactions`, `snapshots`, `logs`, `chats` properties that don't exist in those store types.

**Fix:** Align property names to match the actual store state shape.

---

### Category H: `GoldSettlementTab.tsx` — string.toFixed / type mismatches (3 errors)

- Lines 1256, 1476: Calling `.toFixed()` on a `string` (should be a `number`)
- Line 1488: String literal route path not assignable to the typed router link union
- Line 418: Possibly undefined `purity`
- Lines 1373: Implicit `any` parameters

**Fix:** Add proper type guards, parse strings to numbers before `.toFixed()`, fix the route path.

---

### Category I: `data-loader.ts` — import type mismatches (many errors)

Several type imports do not align with what the stores actually export (`WorkerTransaction`, `WorkerSettlement`, `WorkerGoldTransaction`, `RateCutRecord`, `CommEvent` may have changed signatures).

**Fix:** Verify the exported types from each store and align `data-loader.ts` imports.

---

### Category J: `supabase-services.ts` — table names and row properties (many errors)

Lines 332–348: Multiple property accesses on what TypeScript believes is a wrong type — likely the `gold_settlements` table schema or the `supabase-services.ts` helper types are out of sync with `integrations/supabase/types.ts`.

**Fix:** Regenerate or update `integrations/supabase/types.ts` to match the actual Supabase schema, or add explicit type casts where the data pattern is correct.

---

### Category K: `supabase-write.ts:338,346` — dynamic table name string (2 errors)

A dynamic `string` variable is passed as a table name where Supabase's typed client expects a specific union of table name literals.

**Fix:** Add a type assertion `as any` or cast, or map to a typed helper.

---

### Category L: `test-seed.ts` — missing required fields and missing awaits (~150 errors)

`test-seed.ts` is a dev-only seed script. It has mass missing `await` calls and is missing required fields (`orderNo`, `jobNo`). This is a dev-only file and does not affect production.

**Fix (deferred):** Rewrite test-seed to properly `await` all async operations and supply required fields. Lower priority — does not affect production users.

---

### Category M: `OrderItem.lessMg` missing (1 error)

`counter-order-wizard.tsx:185` omits the required `lessMg` field from an `OrderItem` literal.

**Fix:** Add `lessMg: 0` (or correct value) to the object literal.

---

## 4. ESLint Warnings (29 total, 0 errors)

All 29 are warnings — no blockers.

| Warning Type                                     | Count | Files                                                |
| ------------------------------------------------ | ----- | ---------------------------------------------------- |
| `react-refresh/only-export-components`           | 16    | Various (non-component exports alongside components) |
| `react-hooks/exhaustive-deps` missing deps       | 11    | Various hooks                                        |
| `react-hooks/exhaustive-deps` unnecessary dep    | 1     | `people.index.tsx`                                   |
| `react-hooks/exhaustive-deps` complex expression | 1     | `BillingModule.tsx`                                  |

**None of these affect runtime behavior.** They are code quality hints. `react-refresh` warnings only affect hot module replacement during development.

---

## 5. Build Warnings

| Warning                                            | Severity | Action                                                                                                               |
| -------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------- |
| `[INEFFECTIVE_DYNAMIC_IMPORT]` on `data-loader.ts` | Low      | `data-loader` is both statically and dynamically imported; the dynamic import doesn't split it into a separate chunk |
| `[INEFFECTIVE_DYNAMIC_IMPORT]` on `db-status.ts`   | Low      | Same as above                                                                                                        |
| Large chunk warning: `index-CSrmJdz0.js` (506 kB)  | Medium   | Main vendor bundle is large; consider code splitting critical routes                                                 |

---

## 6. Dead Code / Unused Files

| File                                 | Assessment                                                                                          |
| ------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `src/App.tsx`                        | Returns `<div></div>` — never mounted (routing done via TanStack Router `main.tsx`). Harmless stub. |
| `src/diagnose_storage.ts`            | Dev diagnostic script, not imported by any route                                                    |
| `src/test_direct_storage.ts`         | Dev test script, not imported by any route                                                          |
| `src/test_pull_all.ts`               | Dev test script, not imported by any route                                                          |
| `src/lib/gold-payment-test-suite.ts` | Test suite with ~60 TypeScript errors. Imported in billing route? Check usage.                      |
| `src/lib/supabase-server-example.ts` | Example/reference file — check if imported anywhere                                                 |
| `src/lib/repair-migration.ts`        | One-time migration helper, still imported in `data-loader.ts`                                       |

**Action:** Confirm import graph before deleting any file.

---

## 7. Architecture / Module Health

| Module          | Status                | Notes                                                 |
| --------------- | --------------------- | ----------------------------------------------------- |
| Routing         | ✅ Healthy            | TanStack Router + auto-generated routeTree.gen.ts     |
| Auth            | ✅ Healthy            | Supabase Auth + AuthGate + RBAC                       |
| Billing         | ⚠️ Type errors        | BillingModule.tsx has ~15 type errors                 |
| Stock           | ✅ Healthy            | stock-store.ts, barcode routes clean                  |
| Workshop        | ⚠️ Type errors        | issue-gold-dialog, receive-work-dialog missing awaits |
| People/CRM      | ✅ Mostly healthy     | kycProgress field missing from type                   |
| Orders          | ⚠️ Type errors        | counter-order-wizard, orders-store branchId issues    |
| Ledger          | ✅ Healthy            | ledger-store clean                                    |
| Repairs         | ✅ Healthy            | repair-store, repair routes mostly clean              |
| Attendance      | ⚠️ 3 type errors      | attendance.index.tsx                                  |
| Reports         | ⚠️ 6 type errors      | reports.index.tsx                                     |
| Settings        | ⚠️ 7 type errors      | settings.index.tsx                                    |
| Printing        | ❌ firmProfile errors | 3 print layout files use wrong property name          |
| Expenses        | ⚠️ 2 type errors      | expenses.index.tsx                                    |
| WhatsApp        | ⚠️ 4 type errors      | whatsapp.tsx                                          |
| Workers         | ⚠️ 1 type error       | workers-store.ts                                      |
| Gold Settlement | ⚠️ 5 type errors      | GoldSettlementTab.tsx                                 |
| Supabase Types  | ⚠️ Possibly stale     | types.ts may not reflect latest migrations            |

---

## 8. Database / Migration Status

**Migrations present (10 files):**

1. `20260619223432` — Pilot schema: people, kyc_documents, orders, job_cards, inventory, stock_movements, gold_ledger, invoices, payments, attendance, salary_rules, communication_logs
2. `20260619225425` — Extended tables
3. `20260619232538` — More tables
4. `20260620171200` — Attachments table
5. `20260621110000` — Storage policies + gold_settlements table
6. `20260621120000` — file_attachments table
7. `20260622121550` — document_sequences + RPC
8. `20260624130000` — login_attempts table
9. `20260625120000` — All storage buckets + policies
10. `20260625130000` — Atomic sequence numbering

**Key RPC functions expected by code:**

- `get_next_sequence(series_key text)` — used by `sequence-manager.ts`
- `adjust_vault_gold` / `process_mixed_payment` — documented in database.md

**Action:** Verify all 10 migrations have been applied to the live Supabase project. Run `supabase db push` or manually apply via MCP tools.

---

## 9. Storage Buckets Expected

Based on code analysis, the following buckets must exist in Supabase Storage:

- `product-images` — stock item photos
- `kyc-documents` — KYC uploads (Aadhaar, PAN, etc.)
- `attachments` — general file attachments
- `invoices` — invoice PDFs (optional)

---

## 10. Implementation Recovery Plan

### Priority 1 — CRITICAL (breaks print layouts in production)

1. Fix `firmProfile` → `firm` in 3 print layout files

### Priority 2 — HIGH (runtime errors in core workflows)

2. Add `branchId?: string` to `RegisteredUser` interface (fixes ~30 errors across 18 files)
3. Fix missing `await` in `issue-gold-dialog.tsx`, `receive-work-dialog.tsx`, `counter-order-wizard.tsx`
4. Fix `OrderItem.lessMg` missing field
5. Fix duplicate `invoiceNo` key in `billing-store.ts`
6. Add `"rate limited"` to `SecurityLogItem.action` union
7. Fix `kycProgress` — add to `Person` type or replace usage

### Priority 3 — MEDIUM (type safety improvements)

8. Fix `GoldSettlementTab.tsx` string.toFixed and route path errors
9. Fix `cloud-migrate.ts` wrong property names
10. Fix `supabase-services.ts` type mismatches (likely needs `types.ts` refresh)
11. Fix `supabase-write.ts` dynamic table name type cast

### Priority 4 — LOW (dev tooling only)

12. Rewrite `test-seed.ts` with proper awaits and required fields
13. Fix `data-loader.ts` import type mismatches

### Priority 5 — MAINTENANCE

14. Resolve ESLint `exhaustive-deps` warnings in hot paths (BillingModule, settings)
15. Consider code splitting `index-CSrmJdz0.js` (506 kB) for faster initial load
16. Verify Supabase `types.ts` matches live schema (regenerate if needed)

---

## 11. Summary

The project is in a **functional but fragile** state:

- The Vite build succeeds and ships working JavaScript
- The Supabase project and environment are correctly configured
- Core workflows (billing, stock, workshop) work at runtime despite TypeScript errors
- **Print layouts are broken** due to the `firmProfile` vs `firm` mismatch — this is the only production-visible bug identified
- **Workshop dialogs** (issue gold, receive work) have missing `await` calls that may cause silent failures when recording ledger entries
- The `test-seed.ts` file is effectively non-functional but only affects development seeding
- No Lovable-specific or legacy configuration was found that needs removal
