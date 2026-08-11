# Feature Backlog — Delivery Challan → Invoice Conversion

**Status:** Not scheduled. Deferred out of v1.1 stabilization (found during C-04
investigation, 2026-07-10). Candidate for v1.2 — requires explicit approval
before work starts; do not build without a separate go-ahead.

**Classification:** Missing feature, not a bug. Nothing here regressed —
the conversion path was scaffolded (a status value, a linking field, a
label) but never implemented, most likely because it needs real pricing
UI that doesn't exist yet (see "Required UI" below), not because it was
built and then broke.

---

## Current State

`src/lib/billing-documents-store.ts` — `DeliveryChallan`:

```ts
export type DeliveryChallanStatus = "issued" | "returned" | "converted_to_invoice" | "cancelled";

export interface DeliveryChallanItem {
  itemName: string;
  category: string;
  grossMg: number;
  purity: number;
  fineMg: number;
  qty: number;
}

export interface DeliveryChallan {
  id: string;
  challanNo: string;
  customerId: string;
  customerName: string;
  items: DeliveryChallanItem[];
  purpose: DeliveryChallanPurpose; // "sale_on_approval" | "job_work" | "return" | "transfer" | "other"
  status: DeliveryChallanStatus;
  convertedToInvoiceId?: string;
  branchId?: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}
```

`useDeliveryChallans` store actions that actually exist: `refresh`, `create`,
`markReturned` (issued → returned), `cancel` (issued → cancelled). **No
`convertToInvoice` action exists.**

`src/routes/billing.delivery-challans.$id.tsx` (detail screen) renders a
"Mark Returned" and a "Cancel" button when `status === "issued"`, and
already displays a `"Converted"` badge label for `converted_to_invoice` in
its status-to-label ternary — this label can never actually appear, since
nothing sets that status. `src/routes/billing.delivery-challans.index.tsx`
(list screen) similarly has `converted_to_invoice: "Converted"` in its
label map.

**Net effect:** a delivery challan issued for `sale_on_approval` can only
ever end at "Returned" or "Cancelled" in this app today. If a customer
decides to keep and pay for goods sent on approval, staff must create a
completely separate, disconnected invoice by hand — there is no link back
to the challan, no stock/weight cross-check against what was actually
delivered, and the challan itself is left permanently "Issued" with no way
to close it out.

Compare: `Estimate → Invoice` conversion (`useBillingDocuments`'s
`convertToInvoice` for estimates) **is fully implemented and correct** —
it creates the invoice and sets the estimate's own `status: "converted"` +
`convertedToInvoiceId` in one function, atomically enough (sequential
awaits, both succeed or the function throws). That's the reference
pattern for what the challan version should eventually look like — see
"Required Status Transitions" below, which mirrors it.

---

## Why This Is a Bigger Feature Than It Looks (the reason it was never built)

`DeliveryChallanItem` has no pricing fields at all — no gold rate, no
making charge, no stone charge, no computed value. It only carries
`itemName`, `category`, `grossMg`, `purity`, `fineMg`, `qty` — enough to
describe _what physically left the shop_, nothing about _what it should be
billed at_.

`Estimate`'s items, by contrast, are already full `InvoiceItem` records
(rate, making charge, GST-ready totals) — converting an estimate is
literally "copy the items array, create an Invoice, flip a status." A
delivery challan has no such luxury: converting one to an invoice means
staff must price every item **at conversion time**, which is functionally
a full billing flow (SKU/rate lookup, making charges, GST, discount), not
a one-click status flip. Building this properly means either:

- **(a)** reusing the existing Billing screen (`BillingModule.tsx`),
  pre-filled from the challan's items (weight/purity carried over, price
  fields blank), with the challan linked via a new `sourceDeliveryChallanId`
  concept on `InvoiceItem`/`Invoice` — closer in spirit to how Orders/Job
  Cards already feed into Billing (`orderId`/`jobId` on `Invoice`) — or
- **(b)** a dedicated lightweight pricing step on the challan detail
  screen itself, closer to `Estimate`'s create form.

(a) reuses more existing architecture (Billing already knows how to take
an `orderId`/`jobId` and prefill); (b) is more scoped/isolated. Worth a
real design discussion before either is started — not decided here.

---

## Missing Workflow

1. On a delivery challan with `purpose === "sale_on_approval"` and
   `status === "issued"`, offer a **"Convert to Invoice"** action
   alongside the existing "Mark Returned"/"Cancel" — mutually exclusive
   outcomes (a challan either comes back, gets billed, or is cancelled;
   never more than one).
2. That action opens a pricing step (see options (a)/(b) above) seeded
   with the challan's items (name/weight/purity carried over verbatim —
   no re-weighing, since the goods already physically left with this
   challan's recorded weights).
3. Staff completes pricing (gold rate, making charge, stone charge,
   discount, GST) exactly as they would for any other bill.
4. On save: create the `Invoice` (with a new `sourceDeliveryChallanId`
   field so the link is queryable from the invoice side too, not just
   the challan side), then set the challan's own
   `status: "converted_to_invoice"` + `convertedToInvoiceId: invoice.id`
   in the same function — mirroring `Estimate`'s `convertToInvoice`
   exactly, including its guard (`existing.status !== "issued"` → return
   null, matching Estimate's `!== "draft"` guard).
5. `purpose !== "sale_on_approval"` challans (job_work, return, transfer,
   other) should not offer this action at all — those never represent an
   unbilled sale.

## Missing Business Rules

- Should the invoice's weights be **locked** to the challan's recorded
  weights (no re-entry, preventing a mismatch between what physically
  left and what's billed), or editable with a warning if they diverge?
  Recommend locked, with an explicit "doesn't match" override path only
  if a real discrepancy is found (e.g. a stone was added/removed since
  delivery) — needs a product decision, not an engineering default.
- Partial conversion: can a subset of a challan's items be invoiced (e.g.
  customer keeps 2 of 3 pieces sent) while the rest are returned? If so,
  the challan needs to track per-item status, not just one document-level
  status — a materially bigger data-model change than the rest of this
  ticket. Needs a decision on whether this is in scope for v1.2 or a
  later phase.
- Does converting need to check the underlying Stock item's status (if
  challan items are linked to real inventory) the same way Estimate/
  Billing already do (`Confirm Final Bill` marks stock Sold) — almost
  certainly yes, for the same reason AVS-202/C-03's audit flagged this
  class of gap in the first place, but `DeliveryChallanItem` doesn't
  currently carry a `stockItemId` link either, so this may need its own
  small addition.

## Required UI

- A "Convert to Invoice" button on `billing.delivery-challans.$id.tsx`,
  gated on `status === "issued" && purpose === "sale_on_approval"`.
- Either: (a) a "prefill Billing from challan" entry point (mirroring how
  Orders/Job Cards already launch into `BillingModule.tsx` prefilled), or
  (b) a new lightweight pricing dialog/route scoped to this conversion.
- Challan detail screen should show a link to the resulting invoice once
  `convertedToInvoiceId` is set (mirroring how Estimate's detail screen
  presumably does, or should).
- List screen (`billing.delivery-challans.index.tsx`) already has the
  label ready (`converted_to_invoice: "Converted"`) — no change needed
  there beyond it actually becoming reachable.

## Required Database Changes

- `Invoice` needs a `sourceDeliveryChallanId?: string` field (mirrors
  `orderId`/`jobId`, which already exist on `Invoice` for the equivalent
  Order/Job Card links) — additive, no migration needed for the
  generic-repository-backed `invoices` table (same reasoning as
  `Invoice.billingType` added in this session's C-03 work — the
  repository serializes the whole object, no per-column mapping).
- If per-item stock linkage is added (see "partial conversion" and
  "stock status" questions above), `DeliveryChallanItem` would need a
  `stockItemId?: string` field — a real, if small, schema/type change,
  not yet decided as in-scope.
- No changes needed to `delivery_challans` table beyond what
  `convertedToInvoiceId`/`status` already declare — those columns are
  presumably already provisioned since the TypeScript fields exist (not
  independently verified against the live Supabase schema in this pass).

## Required Status Transitions

```
DeliveryChallan.status:  issued ──┬──> returned    (existing: markReturned)
                                   ├──> cancelled    (existing: cancel)
                                   └──> converted_to_invoice  (MISSING: convertToInvoice)
                                        + sets convertedToInvoiceId
```

Guard: only from `issued`, only when `purpose === "sale_on_approval"` —
mirrors `Estimate.convertToInvoice`'s `existing.status !== "draft"` guard
exactly, adjusted for the extra purpose check this document type needs
that Estimate doesn't.

---

## Explicitly Not Done In This Pass

Per direction received during C-04 (2026-07-10): this document describes
the gap and a proposed shape for the fix, but **no code was written**.
Do not implement any part of this without explicit approval — this is
new-feature work, not a v1.1 stabilization bug fix, and belongs in v1.2
scope per that same direction.
