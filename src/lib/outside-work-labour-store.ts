/**
 * Outside Work — Labour, Billing, Payment & Cost Accounting.
 *
 * Gold movement (issue/receive) lives in outside-work-store.ts. This file
 * covers the money side of the same relationship: what an outside jeweller
 * billed for their labour, what's been paid, and what's still owed. Gold
 * Settlement is handled by the existing gold-settlement-store.ts (reused,
 * not duplicated) — this file only adds labour charges + payments, which
 * that engine has no concept of.
 *
 * Two append-only logs, same shape as outside-work-store.ts's transaction
 * log: every OutsideWorkLabourCharge and OutsideWorkPayment is immutable —
 * "outstanding" is always derived (totalBilled - totalPaid), never stored
 * and edited directly, so nothing here can silently drift from the truth.
 */
import { create } from "zustand";
import { createRepository } from "./repositories/base-repository";
import { fetchOutsideWorkLabourCharges, fetchOutsideWorkPayments } from "./outside-work-query";

/**
 * Not a closed enum — new calculation methods can be added by any caller
 * without touching this type. This list only seeds the dialog's dropdown
 * with sane defaults; `calculationMethod` on a charge is a free string.
 */
export const OUTSIDE_WORK_LABOUR_METHODS = [
  { value: "per_gram", label: "Per Gram (fine)" },
  { value: "per_piece", label: "Per Piece" },
  { value: "fixed", label: "Fixed Amount" },
  { value: "per_gram_gross", label: "Per Gram (gross)" },
  { value: "custom", label: "Custom / Negotiated" },
] as const;

export interface OutsideWorkLabourCharge {
  id: string;
  ts: number;
  jewellerId: string;
  jewellerName: string;
  orderId?: string;
  orderNo?: string;
  /** Links this bill to the gold issue/receive transaction it covers, if any. */
  outsideWorkTxnId?: string;

  calculationMethod: string; // see OUTSIDE_WORK_LABOUR_METHODS — free string, not a closed enum
  /** Quantity the calculation method is applied against (pieces, or fine grams ×1000 as mg — caller's choice; purely informational, not used in totals math beyond display). */
  quantityBasis?: number;
  ratePaise?: number; // rate per unit of quantityBasis, if applicable

  labourChargePaise: number;
  gstEnabled: boolean;
  gstRatePct: number;
  gstAmountPaise: number;
  totalPaise: number; // labourChargePaise + gstAmountPaise

  billNumber?: string;
  billDate?: string; // YYYY-MM-DD
  billAttachmentDataUrl?: string;
  billAttachmentFileName?: string;
  remarks?: string;

  approved: boolean;
  approvedAt?: number;

  // ── Extension points — reserved, not implemented in this phase ────────
  /** Future: link to the settlement this charge was ultimately closed under. */
  settlementId?: string;
  /** Future: communication sent flag once WhatsApp/portal integration exists. */
  communicationSent?: boolean;
  /** Set once this charge has been auto-collected into a Manufacturing Bill's Outside Work Charges total — guards against double-counting on a later auto-collect pass. */
  manufacturingBillId?: string;
}

export interface OutsideWorkPayment {
  id: string;
  ts: number;
  jewellerId: string;
  jewellerName: string;
  amountPaise: number;
  mode: "cash" | "upi" | "bank" | "cheque";
  reference?: string;
  notes?: string;
  /** Optional: which labour charge(s) this payment is against — informational allocation, not enforced. */
  linkedLabourChargeIds?: string[];
  orderId?: string;
  orderNo?: string;

  // ── Extension points ───────────────────────────────────────────────────
  settlementId?: string;
}

const labourChargeRepository = createRepository<OutsideWorkLabourCharge>(
  "outside_work_labour_charges",
);
const paymentRepository = createRepository<OutsideWorkPayment>("outside_work_payments");

function makeId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto)
    return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

interface OutsideWorkLabourState {
  charges: OutsideWorkLabourCharge[];
  payments: OutsideWorkPayment[];
  refresh: () => Promise<void>;
  addCharge: (
    input: Omit<OutsideWorkLabourCharge, "id" | "ts">,
  ) => Promise<OutsideWorkLabourCharge>;
  approveCharge: (id: string) => Promise<void>;
  addPayment: (input: Omit<OutsideWorkPayment, "id" | "ts">) => Promise<OutsideWorkPayment>;
  chargesForJeweller: (jewellerId: string) => OutsideWorkLabourCharge[];
  paymentsForJeweller: (jewellerId: string) => OutsideWorkPayment[];
  chargesForOrder: (orderId: string) => OutsideWorkLabourCharge[];
  /** Stamps this charge as consumed by a Manufacturing Bill — guards against
   *  a later auto-collect pass double-counting it. */
  linkChargeToManufacturingBill: (id: string, billId: string) => Promise<void>;
  reset: () => void;
}

export const useOutsideWorkLabour = create<OutsideWorkLabourState>()((set, get) => ({
  charges: [],
  payments: [],
  refresh: async () => {
    const [charges, payments] = await Promise.all([
      fetchOutsideWorkLabourCharges(),
      fetchOutsideWorkPayments(),
    ]);
    set({ charges, payments });
  },
  // Supabase append log: no
  // document-numbering RPC dependency (unlike outside-work-store.ts's own
  // transactions, which call nextDocumentNumber() and so aren't safe to
  // migrate yet), so writes surface Supabase failures instead of queueing locally.
  // way material_vault_movements already does — write completes locally,
  // The caller updates UI only after the Supabase write succeeds.
  addCharge: async (input) => {
    const charge: OutsideWorkLabourCharge = { ...input, id: makeId("owlc"), ts: Date.now() };
    await labourChargeRepository.save(charge);
    set((s) => ({ charges: [charge, ...s.charges] }));
    return charge;
  },
  approveCharge: async (id) => {
    const charge = get().charges.find((c) => c.id === id);
    if (!charge || charge.approved) return;
    const updated: OutsideWorkLabourCharge = { ...charge, approved: true, approvedAt: Date.now() };
    await labourChargeRepository.save(updated);
    set((s) => ({ charges: s.charges.map((c) => (c.id === id ? updated : c)) }));
  },
  addPayment: async (input) => {
    const payment: OutsideWorkPayment = { ...input, id: makeId("owpay"), ts: Date.now() };
    await paymentRepository.save(payment);
    set((s) => ({ payments: [payment, ...s.payments] }));
    return payment;
  },
  chargesForJeweller: (jewellerId) =>
    get()
      .charges.filter((c) => c.jewellerId === jewellerId)
      .sort((a, b) => b.ts - a.ts),
  paymentsForJeweller: (jewellerId) =>
    get()
      .payments.filter((p) => p.jewellerId === jewellerId)
      .sort((a, b) => b.ts - a.ts),
  chargesForOrder: (orderId) => get().charges.filter((c) => c.orderId === orderId),
  linkChargeToManufacturingBill: async (id, billId) => {
    const charge = get().charges.find((c) => c.id === id);
    if (!charge || charge.manufacturingBillId) return;
    const updated: OutsideWorkLabourCharge = { ...charge, manufacturingBillId: billId };
    await labourChargeRepository.save(updated);
    set((s) => ({ charges: s.charges.map((c) => (c.id === id ? updated : c)) }));
  },
  reset: () => set({ charges: [], payments: [] }),
}));

export interface OutsideWorkLabourPosition {
  totalLabourPaise: number;
  totalGstPaise: number;
  totalBilledPaise: number; // labour + gst, all charges regardless of approval
  totalPaidPaise: number;
  outstandingPaise: number; // max(0, totalBilledPaise - totalPaidPaise)
  advancePaise: number; // max(0, totalPaidPaise - totalBilledPaise)
  chargeCount: number;
  paymentCount: number;
  /** Same totals, restricted to approved charges only — this is the figure
   *  a Settlement should be capped against when approval is required, since
   *  an unapproved bill is genuinely owed but not yet clear to close out. */
  approvedBilledPaise: number;
  approvedOutstandingPaise: number;
}

/**
 * Visibility-only labour position for one outside jeweller. Payments are
 * matched against the aggregate outstanding, not allocated to individual
 * bills (per spec: "Maintain Total Labour, Amount Paid, Outstanding
 * Amount" — no per-bill reconciliation was asked for).
 */
export function computeOutsideWorkLabourPosition(
  charges: OutsideWorkLabourCharge[],
  payments: OutsideWorkPayment[],
): OutsideWorkLabourPosition {
  const totalLabourPaise = charges.reduce((sum, c) => sum + c.labourChargePaise, 0);
  const totalGstPaise = charges.reduce((sum, c) => sum + c.gstAmountPaise, 0);
  const totalBilledPaise = totalLabourPaise + totalGstPaise;
  const totalPaidPaise = payments.reduce((sum, p) => sum + p.amountPaise, 0);
  const approvedBilledPaise = charges
    .filter((c) => c.approved)
    .reduce((sum, c) => sum + c.totalPaise, 0);
  return {
    totalLabourPaise,
    totalGstPaise,
    totalBilledPaise,
    totalPaidPaise,
    outstandingPaise: Math.max(0, totalBilledPaise - totalPaidPaise),
    advancePaise: Math.max(0, totalPaidPaise - totalBilledPaise),
    chargeCount: charges.length,
    paymentCount: payments.length,
    approvedBilledPaise,
    approvedOutstandingPaise: Math.max(0, approvedBilledPaise - totalPaidPaise),
  };
}

/**
 * Manufacturing Cost integration: every labour charge automatically
 * contributes to the linked Production Order's cost — read here, not
 * written into manufacturing-bill-store.ts (that engine is for internal
 * karigar job costing; outside-work cost is a separate rollup an order or
 * a future manufacturing bill can pull in on demand, with zero duplicate
 * data entry required from the operator).
 */
export function computeOutsideWorkCostForOrder(
  charges: OutsideWorkLabourCharge[],
  orderId: string,
): number {
  return charges.filter((c) => c.orderId === orderId).reduce((sum, c) => sum + c.totalPaise, 0);
}
