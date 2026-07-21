# Repository Duplication Analysis

Read-only audit. **Nothing was modified.** Findings are consolidation targets ranked by leverage. Line counts are file-level signals, not exhaustive.

## 1. Parallel PDF generators (highest priority)

The Universal Print Engine's `src/lib/print-engine/pdf/generate.ts` is meant to be the single PDF path, but legacy per-document generators still exist and are still called:

- `src/lib/pdf/document-pdf-generator.ts`
- `src/lib/pdf/gold-settlement-pdf.ts`
- `src/lib/pdf/outside-worker-statement-pdf.ts`
- `src/lib/document-pdf-service.ts`

Callers outside `print-engine/`: `outside-work-statement-dialog.tsx`, `comm/service.ts`, `outside-work-statement.ts`, `print/print-queue.ts`, `billing.gold-settlement-print.$id.tsx`, `doc.$token.tsx`.

**Action (later):** migrate each to a Print Engine docType + template, then delete the legacy generator. Do NOT duplicate — extend the engine.

## 2. Direct `window.print()` document routes (17 print routes, 12 `window.print` files)

Document-style prints still calling `window.print()` instead of `<PrintEngine>`: `attendance.print`, `billing.receipt`, `billing.settlement-slip`, `stock.print`, `reports.delivery-summary`, `reports.index`, `ledger.tsx` (dashboard whole-page print is acceptable), plus 17 `*print*.$id.tsx` routes.

Legit (leave): `print/PrintPreviewModal.tsx` (the engine's own modal), `manufacturing-tag-print-dialog.tsx` + `barcode.tsx` (hardware/label paths), `doc.$token.tsx` (public token view).

**Action (later):** migrate the document routes per `PRINT_ENGINE.md`; keep hardware paths.

## 3. Hardcoded WhatsApp links

Canonical builder: `src/lib/wa-link.ts` (+ `.selfcheck.ts`, `comm/types.ts`) — **this is the source of truth, keep it.** Screens that still build/open links themselves instead of routing through `send-whatsapp-text.ts`: `reminder-dialog.tsx`, `communications.index.tsx`, and the deep-link branch inside `doc-comm-actions.tsx`.

**Action (later):** route these through `sendWhatsAppText` / the provider seam so a provider switch needs no screen edits.

## 4. Export utilities — clean ✓

Only `src/lib/report-engine.ts` implements CSV/XLSX. No duplication. Keep enforcing single-engine use.

## 5. Weight/money helpers — clean ✓

Single definitions of `mgToGrams`, `gramsToMg`, `formatWeight` in `src/lib/gold.ts`. No duplicates found.

## 6. Direct `supabase.from(...)` usage (18 files)

Some are legitimate store `refresh()` reads; some may be write paths that should go through `createRepository` + outbox. **Action (later):** audit each of the 18 to confirm no write bypasses the outbox (offline-safety risk). Not all are defects — reads are fine.

## 7. Dialog components (13 `*dialog*.tsx`)

No obvious duplication, but review `outside-work-*-dialog`, `worker-issue`/`worker-return` dialogs, and the material stock/adjustment dialogs for a shared "material movement dialog" abstraction once Outside/Polishing books are built.

## Summary

| Area | Status | Priority |
|---|---|---|
| Legacy PDF generators | duplicate of Print Engine | High |
| `window.print` doc routes | pre-engine | Medium (phased) |
| WhatsApp link building | partial centralization | Medium |
| Export engine | single ✓ | — |
| Gold/money helpers | single ✓ | — |
| Supabase direct access | audit needed | Medium |

No changes applied. Each item is a scoped, individually-verifiable migration.
