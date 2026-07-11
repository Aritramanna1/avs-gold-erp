# Version 1.1 Stabilization Sprint — Manual Testing Round 1

Living tracking document. Updated after every fix with root cause, files modified, validation performed, and status.

**Verification steps run after every fix** (abbreviated below as "Full verification"): TypeScript, ESLint, Production Build, Electron Build, Playwright, Reticle (if available), runtime verification, regression pass (Orders / Workshop / Worker Gold Book / Billing / Inventory / Catalog / Reports / Printing / KYC / Communications).

---

## Priority 0 – Workflow Corrections

### P0-1. Remove separate Create Job Card page/dialog; auto-generate from Order
**Status:** Open

**Clarified with user:** Job Card is created fully automatically the moment an Order reaches its production-ready status (no button, no dialog). Karigar/priority/dates remain editable afterward from the Job Card itself.

**Investigation:** "Create Job Card" is not a standalone route — it's `CreateJobCardDialog`, an inline dialog in `src/routes/orders.$id.tsx` (lines ~952-1124), triggered by a button (line ~574-578). New orders are created with `status: "awaiting_job_card"` in `src/routes/orders.new.tsx` (line 203) — the natural hook point for automatic creation. `src/lib/orders-tracking.ts`'s `pendingJobCard` queue (line 56) becomes dead/always-empty once this lands and needs addressing, not left stale.

**Plan:** Auto-create the Job Card synchronously when an order is saved with (or transitions to) `awaiting_job_card`/`confirmed`; remove the dialog and button; remove or repurpose the now-always-empty `pendingJobCard` queue.

---

### P0-2. Remove separate Worker Issue page; gold issue only through Worker Gold Book
**Status:** Open

**Clarified with user:** One entry point only — Worker Gold Book page. Keep all 3 underlying writes (Gold Ledger + Material Vault + Worker Gold Book) unchanged; they're independent reports, not duplicates.

**Investigation:** "Worker Issue" is `WorkerIssueDialog` (`src/components/worker-issue-dialog.tsx`), invoked from two places: `src/routes/orders.$id.tsx` and `src/routes/workshop.$id.tsx` (job card detail). Writes to `useLedger`, `useMaterialVault`, and `useWorkerGoldBook` in one save.

**Plan:** Remove the two non-Worker-Gold-Book entry points; confirm/build the equivalent issue flow inside `workshop.gold-book.tsx` if not already present with full parity (order linkage, material vault sync).

---

## Priority 1 – Critical Bugs
1. Multiple items per order — Open
2. Gold Received purity field — Open
3. Automatic Catalog entry from uploaded design — Open
4. Reference image missing on Job Card — Open
5. Print Preview loading indefinitely — Open
6. Total pages always showing 0 — Open
7. Printing not working — Open
8. Print dialog cannot be closed — Open
9. Worker Gold Book print failures — Open
10. Catalog integration failure — Open

## Priority 2 – High Priority
1. Logo missing in downloaded PDFs — Open
2. Universal print interface — Open
3. Table overflow — Open
4. Landscape printing — Open
5. Margins ignored — Open

## Priority 3 – Medium Priority
1. Multiple paper sizes — Open
2. Optional Order selection in Worker Gold Book — Open
3. Ledger PDF/Export — Open
4. XLS/XLSX import — Open

---

## Completion Report
_To be filled in once all items are addressed._
