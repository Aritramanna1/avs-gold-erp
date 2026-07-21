/**
 * Customer Settlement — Draft → Delivery → Final Settlement lifecycle.
 *
 * This is the desktop-only workflow standing in for what a future Dealer
 * Portal / Employee Portal will eventually confirm/record online — every
 * write path here is written so those portals can plug in later without a
 * redesign: `recordPayment()`/`applyExistingCredit()`/`completeFinalSettlement()`
 * are the exact same calls a portal-side handler would make, and the
 * reserved fields at the bottom of `Settlement` are where that portal's own
 * identifiers will attach once built.
 *
 * Deliberately reuses, not reinvents:
 *  - `InvoiceItem`/`PaymentRecord`/`PaymentMode` from billing-store.ts — a
 *    Settlement's items and payments are the exact same shapes an Invoice
 *    uses, so `completeFinalSettlement()` can hand them straight to
 *    `useBilling.getState().add()` with zero transformation.
 *  - `computeInvoiceTotals()` for BOTH the Draft's GST/TCS *preview* (pure,
 *    nothing saved) and the Final Settlement's real GST Invoice — same
 *    math, so the number on the draft a customer saw is exactly the number
 *    on the invoice they get.
 *  - `compileCustomerLedger()` for existing Gold Credit / Cash Credit /
 *    Advance detection — no separate credit-tracking system.
 *  - The Gold Ledger integration already added to `useBilling.addPayment()`
 *    for gold_exchange payments — a Settlement's gold payments post through
 *    that exact same path once folded into the Invoice at Final Settlement.
 */
import { create } from "zustand";
import { createRepository } from "./repositories/base-repository";
import {
  useBilling,
  computeInvoiceTotals,
  computeItemTotals,
  type Invoice,
  type InvoiceItem,
  type PaymentRecord,
  type PaymentMode,
  type GstKind,
} from "./billing-store";
import { compileCustomerLedger } from "./customer-account-ledger";
import { nextDocumentNumber } from "./document-numbering";

export type FinancialStatus =
  "pending_settlement" | "partially_settled" | "settled" | "credit_delivery";

export const FINANCIAL_STATUS_LABELS: Record<FinancialStatus, string> = {
  pending_settlement: "Pending Settlement",
  partially_settled: "Partially Settled",
  settled: "Settled",
  credit_delivery: "Credit Delivery",
};

export type DeliveryStatus = "ready" | "delivered" | "closed";

export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  ready: "Ready",
  delivered: "Delivered",
  closed: "Closed",
};

export interface Settlement {
  id: string;
  settlementNo: string;
  createdAt: number;
  updatedAt: number;
  branchId?: string;

  customerId: string;
  customerName: string;
  customerPhone?: string;
  orderId?: string;
  orderNo?: string;

  /** Same shape an Invoice uses — no separate item model. */
  items: InvoiceItem[];
  gst: GstKind;

  /**
   * Existing credit snapshotted from compileCustomerLedger() at draft
   * creation time, purely for the printed Draft's "Gold Balance" figure.
   * Final Settlement always re-reads the LIVE ledger before applying
   * credit — this snapshot is never itself applied as payment.
   */
  existingGoldCreditMgAtDraft: number;
  existingCashCreditPaiseAtDraft: number;

  /** Gold/cash credit actually applied at Final Settlement — each recorded as its own PaymentRecord (mode customer_gold_credit / advance), never a hidden adjustment. */
  goldCreditUsedMg: number;
  cashCreditUsedPaise: number;

  /** Same PaymentRecord shape Invoices use. */
  payments: PaymentRecord[];

  /** Derived — never set directly except by recomputeFinancialStatus(). */
  financialStatus: FinancialStatus;
  /** Independent of financialStatus — maintained separately per spec. */
  deliveryStatus: DeliveryStatus;

  /** Set once completeFinalSettlement() creates the real GST Invoice. */
  linkedInvoiceId?: string;
  linkedInvoiceNo?: string;
  finalisedAt?: number;

  notes?: string;
  dealerRemarks?: string;
  employeeRemarks?: string;

  /**
   * Name of the delivery person carrying this settlement's Draft out to the
   * dealer/customer — set by the operator when marking a settlement
   * "Delivered". Purely an internal reconciliation field: it drives the
   * Daily Delivery Summary / Delivery Person Summary reports and is never
   * printed on any customer-facing document (Draft, Receipt, or Invoice).
   */
  deliveryPersonName?: string;
  /** Stamped once, the first time deliveryStatus transitions to "delivered" —
   *  the actual delivery date/time for the Daily Delivery Summary, distinct
   *  from updatedAt (which changes on every later edit to this settlement). */
  deliveredAt?: number;

  // ── Future Portal extension points — reserved, NOT implemented ────────
  /** Future: Dealer Portal's own confirmation timestamp for this settlement. */
  dealerPortalConfirmedAt?: number;
  /** Future: Dealer Portal sync/session id. */
  dealerPortalSyncId?: string;
  /** Future: which employee (portal user) is carrying/recording this settlement. */
  employeeId?: string;
  /** Future: Employee Portal device/session id that recorded the payment. */
  employeePortalDeviceId?: string;
}

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `stl_${crypto.randomUUID()}`;
  return `stl_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function makeSettlementNo(): Promise<string> {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const prefix = `SET-${ymd}-`;
  return nextDocumentNumber(`settlement:${ymd}`, prefix, 3);
}

/**
 * Financial Status is ALWAYS derived — never manually chosen. Credit
 * Delivery only applies once the jewellery has actually left (delivered/
 * closed) with a balance still outstanding; before delivery, an unpaid
 * balance is just "Partially Settled" (or "Pending Settlement" pre-final).
 */
export function computeFinancialStatus(
  finalised: boolean,
  balancePaise: number,
  paidPaise: number,
  deliveryStatus: DeliveryStatus,
): FinancialStatus {
  if (!finalised) return "pending_settlement";
  if (balancePaise <= 0) return "settled";
  if (deliveryStatus !== "ready") return "credit_delivery";
  return paidPaise > 0 ? "partially_settled" : "pending_settlement";
}

/** Pure preview of what Final Settlement's GST Invoice would total right now — nothing is saved. Draft printing and the operator screen both call this so the number is identical everywhere it's shown. */
export function previewSettlementTotals(
  items: InvoiceItem[],
  gst: GstKind,
  payments: PaymentRecord[] = [],
) {
  return computeInvoiceTotals(items, gst, undefined, payments);
}

const settlementRepository = createRepository<Settlement>("customer_settlements");

interface SettlementState {
  settlements: Settlement[];
  refresh: () => Promise<void>;
  createDraft: (
    input: Omit<
      Settlement,
      | "id"
      | "settlementNo"
      | "createdAt"
      | "updatedAt"
      | "payments"
      | "financialStatus"
      | "deliveryStatus"
      | "goldCreditUsedMg"
      | "cashCreditUsedPaise"
      | "existingGoldCreditMgAtDraft"
      | "existingCashCreditPaiseAtDraft"
    >,
  ) => Promise<Settlement>;
  /** Applies existing customer Gold Credit and/or Cash Credit as payment(s) — reuses the same PaymentMode the rest of the app already recognises (customer_gold_credit / advance), so nothing downstream needs to know this came from a settlement rather than an invoice. */
  applyExistingCredit: (
    id: string,
    input: { goldCreditMg?: number; cashCreditPaise?: number },
  ) => Promise<void>;
  recordPayment: (
    id: string,
    p: Omit<PaymentRecord, "id" | "ts"> & { id?: string; ts?: number },
  ) => Promise<PaymentRecord>;
  /** Adds one more product line to a still-draft settlement — a single
   *  delivery settlement can cover several items for the same customer
   *  (e.g. a ring and a chain delivered together), not just one. */
  addItem: (
    id: string,
    item: Omit<InvoiceItem, "id" | "goldValuePaise" | "lineTotalPaise">,
  ) => Promise<Settlement>;
  /** Removes one product line from a still-draft settlement. */
  removeItem: (id: string, itemId: string) => Promise<void>;
  setDeliveryStatus: (id: string, status: DeliveryStatus) => Promise<void>;
  patchRemarks: (
    id: string,
    diff: { dealerRemarks?: string; employeeRemarks?: string; deliveryPersonName?: string },
  ) => Promise<void>;
  /**
   * The ONLY place a GST Invoice gets created from a Settlement — never
   * from the Draft. Hands the settlement's own items/payments straight to
   * useBilling.add(), so the real invoice totals are computed by the exact
   * same computeInvoiceTotals() the draft preview already used.
   */
  completeFinalSettlement: (id: string, branchId: string) => Promise<Invoice>;
  reset: () => void;
}

export const useSettlements = create<SettlementState>()((set, get) => ({
  settlements: [],
  refresh: async () => set({ settlements: await settlementRepository.readAll() }),

  createDraft: async (input) => {
    const now = Date.now();
    const ledger = compileCustomerLedger(input.customerId);
    const settlement: Settlement = {
      ...input,
      id: makeId(),
      settlementNo: await makeSettlementNo(),
      createdAt: now,
      updatedAt: now,
      payments: [],
      financialStatus: "pending_settlement",
      deliveryStatus: "ready",
      goldCreditUsedMg: 0,
      cashCreditUsedPaise: 0,
      existingGoldCreditMgAtDraft: ledger.goldAdvanceMg,
      existingCashCreditPaiseAtDraft: ledger.moneyAdvancePaise,
    };
    await settlementRepository.save(settlement);
    set((s) => ({ settlements: [settlement, ...s.settlements] }));
    return settlement;
  },

  applyExistingCredit: async (id, input) => {
    const s = get().settlements.find((x) => x.id === id);
    if (!s) return;
    const ledger = compileCustomerLedger(s.customerId);
    // BUG FIX (found during review): compileCustomerLedger() only sees
    // PAST invoices/settlements — a credit already applied to THIS
    // in-progress settlement (recorded only in s.payments, since no
    // invoice exists yet) is invisible to it. Reading ledger.goldAdvanceMg
    // directly on a second click would double-apply the same credit as a
    // second payment. Subtracting what THIS settlement has already
    // consumed makes re-clicking a safe no-op instead.
    const goldCreditMg = Math.min(
      input.goldCreditMg ?? 0,
      Math.max(0, ledger.goldAdvanceMg - s.goldCreditUsedMg),
    );
    const cashCreditPaise = Math.min(
      input.cashCreditPaise ?? 0,
      Math.max(0, ledger.moneyAdvancePaise - s.cashCreditUsedPaise),
    );
    const now = Date.now();
    const newPayments: PaymentRecord[] = [...s.payments];
    if (goldCreditMg > 0) {
      newPayments.push({
        id: `pay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        ts: now,
        mode: "customer_gold_credit",
        amountPaise: 0,
        goldFineMg: goldCreditMg,
        notes: "Existing Gold Credit applied",
      });
    }
    if (cashCreditPaise > 0) {
      newPayments.push({
        id: `pay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        ts: now + 1,
        mode: "advance",
        amountPaise: cashCreditPaise,
        notes: "Existing Cash Credit applied",
      });
    }
    const updated: Settlement = {
      ...s,
      payments: newPayments,
      goldCreditUsedMg: s.goldCreditUsedMg + goldCreditMg,
      cashCreditUsedPaise: s.cashCreditUsedPaise + cashCreditPaise,
      updatedAt: now,
    };
    await settlementRepository.save(updated);
    set((st) => ({ settlements: st.settlements.map((x) => (x.id === id ? updated : x)) }));
  },

  recordPayment: async (id, p) => {
    const s = get().settlements.find((x) => x.id === id);
    if (!s) throw new Error("Settlement not found");
    // BUG FIX (found during Pilot Phase 2 review): this store function
    // itself had no validation — only the UI blocked a zero/negative
    // amount, so any other caller (a future Employee Portal handler, a
    // retry, a scripted call) could push bad data straight into
    // payments[]. Gold-exchange payments are validated by fine gold
    // weight, not cash value — a small gold payment's cash equivalent can
    // legitimately round to 0 paise.
    if (p.mode === "gold_exchange") {
      if ((p.goldFineMg ?? 0) <= 0) {
        throw new Error("Gold payment must have a positive fine gold weight.");
      }
    } else if (p.amountPaise <= 0) {
      throw new Error("Payment amount must be greater than zero.");
    }
    const pay: PaymentRecord = {
      id: p.id ?? `pay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      ts: p.ts ?? Date.now(),
      mode: p.mode,
      amountPaise: p.amountPaise,
      reference: p.reference,
      notes: p.notes,
      goldGrossMg: p.goldGrossMg,
      goldPurity: p.goldPurity,
      goldFineMg: p.goldFineMg,
      goldRatePerGramPaise: p.goldRatePerGramPaise,
    };
    const updated: Settlement = { ...s, payments: [...s.payments, pay], updatedAt: Date.now() };
    await settlementRepository.save(updated);
    set((st) => ({ settlements: st.settlements.map((x) => (x.id === id ? updated : x)) }));
    return pay;
  },

  addItem: async (id, itemInput) => {
    const s = get().settlements.find((x) => x.id === id);
    if (!s) throw new Error("Settlement not found");
    if (s.finalisedAt) throw new Error("Cannot add items after Final Settlement.");
    const base = { id: makeId().replace("stl_", "it_"), ...itemInput };
    const totals = computeItemTotals(base);
    const item: InvoiceItem = { ...base, ...totals };
    const updated: Settlement = { ...s, items: [...s.items, item], updatedAt: Date.now() };
    await settlementRepository.save(updated);
    set((st) => ({ settlements: st.settlements.map((x) => (x.id === id ? updated : x)) }));
    return updated;
  },

  removeItem: async (id, itemId) => {
    const s = get().settlements.find((x) => x.id === id);
    if (!s) return;
    if (s.finalisedAt) throw new Error("Cannot remove items after Final Settlement.");
    if (s.items.length <= 1) throw new Error("A settlement must have at least one item.");
    const updated: Settlement = {
      ...s,
      items: s.items.filter((it) => it.id !== itemId),
      updatedAt: Date.now(),
    };
    await settlementRepository.save(updated);
    set((st) => ({ settlements: st.settlements.map((x) => (x.id === id ? updated : x)) }));
  },

  setDeliveryStatus: async (id, status) => {
    const s = get().settlements.find((x) => x.id === id);
    if (!s) return;
    const updated: Settlement = {
      ...s,
      deliveryStatus: status,
      deliveredAt: status === "delivered" && !s.deliveredAt ? Date.now() : s.deliveredAt,
      updatedAt: Date.now(),
    };
    // Financial status can depend on delivery status (Credit Delivery) —
    // recompute it here too so the two stay consistent without a second
    // manual step.
    const totals = computeInvoiceTotals(updated.items, updated.gst, undefined, updated.payments);
    updated.financialStatus = computeFinancialStatus(
      !!updated.finalisedAt,
      totals.balancePaise,
      totals.paidPaise,
      status,
    );
    await settlementRepository.save(updated);
    set((st) => ({ settlements: st.settlements.map((x) => (x.id === id ? updated : x)) }));
  },

  patchRemarks: async (id, diff) => {
    const s = get().settlements.find((x) => x.id === id);
    if (!s) return;
    const updated: Settlement = { ...s, ...diff, updatedAt: Date.now() };
    await settlementRepository.save(updated);
    set((st) => ({ settlements: st.settlements.map((x) => (x.id === id ? updated : x)) }));
  },

  completeFinalSettlement: async (id, branchId) => {
    const s = get().settlements.find((x) => x.id === id);
    if (!s) throw new Error("Settlement not found");
    if (s.linkedInvoiceId) {
      const existing = useBilling.getState().invoices.find((i) => i.id === s.linkedInvoiceId);
      if (existing) return existing; // already finalised — no duplicate invoice
    }
    // BUG FIX (found during Pilot Phase 2 review): the check above reads
    // in-memory Zustand state, which two rapid clicks (or two browser
    // tabs) can both observe as "not yet finalised" before either await
    // below resolves — each would then create its own GST Invoice for the
    // same settlement. This in-flight lock closes that window for the
    // same-tab case (the most common real-world trigger: an impatient
    // double-click); a cross-tab/DB-level guard would need a unique
    // constraint at the repository layer, out of scope for this fix.
    if (finalisingInFlight.has(id)) {
      throw new Error("Final Settlement is already in progress for this settlement.");
    }
    finalisingInFlight.add(id);

    try {
      return await finaliseNow(get, set, id, branchId);
    } finally {
      finalisingInFlight.delete(id);
    }
  },

  reset: () => set({ settlements: [] }),
}));

const finalisingInFlight = new Set<string>();

async function finaliseNow(
  get: () => SettlementState,
  set: (fn: (s: SettlementState) => Partial<SettlementState>) => void,
  id: string,
  branchId: string,
): Promise<Invoice> {
  const s = get().settlements.find((x) => x.id === id);
  if (!s) throw new Error("Settlement not found");
  if (s.linkedInvoiceId) {
    const existing = useBilling.getState().invoices.find((i) => i.id === s.linkedInvoiceId);
    if (existing) return existing;
  }

  const totals = computeInvoiceTotals(s.items, s.gst, undefined, s.payments);
  const invoice = await useBilling.getState().add({
    invoiceNo: undefined as unknown as string, // auto-generated by add() when omitted
    customerId: s.customerId,
    customerName: s.customerName,
    customerPhone: s.customerPhone,
    orderId: s.orderId,
    orderNo: s.orderNo,
    items: s.items,
    gst: s.gst,
    cgstPaise: totals.cgstPaise,
    sgstPaise: totals.sgstPaise,
    gstPaise: totals.gstPaise,
    tcsPaise: totals.tcsPaise,
    gstGoldEquivalentMg: totals.gstGoldEquivalentMg,
    subtotalPaise: totals.subtotalPaise,
    adjustmentPaise: totals.adjustmentPaise,
    grandTotalPaise: totals.grandTotalPaise,
    paidPaise: totals.paidPaise,
    balancePaise: totals.balancePaise,
    payments: s.payments,
    status: totals.balancePaise <= 0 ? "paid" : totals.paidPaise > 0 ? "partial" : "issued",
    notes: `Generated from Settlement ${s.settlementNo}`,
    branchId,
  });

  const now = Date.now();
  const financialStatus = computeFinancialStatus(
    true,
    totals.balancePaise,
    totals.paidPaise,
    s.deliveryStatus,
  );
  const updated: Settlement = {
    ...s,
    linkedInvoiceId: invoice.id,
    linkedInvoiceNo: invoice.invoiceNo,
    finalisedAt: now,
    financialStatus,
    updatedAt: now,
  };
  await settlementRepository.save(updated);
  set((st) => ({ settlements: st.settlements.map((x) => (x.id === id ? updated : x)) }));

  // Best-effort — a logging failure must never block a settlement that has
  // already succeeded and posted its invoice (same pattern as
  // base-repository.ts's recordAuditBestEffort).
  try {
    const [{ append }, { supabase: sb }] = await Promise.all([
      import("./security/audit-log"),
      import("@/lib/providers/data-provider"),
    ]);
    const { data } = await sb.auth.getSession();
    await append({
      actorId: data.session?.user.id ?? null,
      actorEmail: data.session?.user.email ?? null,
      action: "settlement.finalise",
      entityType: "settlements",
      entityId: id,
      before: { linkedInvoiceId: s.linkedInvoiceId ?? null },
      after: { linkedInvoiceId: invoice.id, linkedInvoiceNo: invoice.invoiceNo },
      deviceId: null,
    });
  } catch (err) {
    console.error("[SettlementStore] Failed to audit-log settlement finalisation:", err);
  }

  return invoice;
}
