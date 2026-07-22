/**
 * Billing & Printing audit — the four document types that were entirely
 * missing: Credit Notes, Debit Notes, Estimates, Delivery Challans. Each
 * gets its own real sequence number (sequence-manager.ts), its own status
 * lifecycle, and — for Credit/Debit Notes specifically — an audit log
 * entry on issue/cancellation, since these directly adjust what a
 * customer owes (a financial action, per Step 8's "every financial action
 * must be fully auditable" requirement).
 *
 * Deliberately reuses billing-store.ts's InvoiceItem shape for Estimate
 * line items rather than inventing a parallel item type — an Estimate is
 * structurally "the same line items an invoice would have," and
 * convertToInvoice() below relies on that shape match to hand items
 * straight to useBilling.add() without any field remapping.
 */
import { create } from "zustand";
import { createRepository } from "./repositories/base-repository";
import { append as appendAuditEntry } from "./security/audit-log";
import { getNextSequenceNumber } from "./sequence-manager";
import { useBilling, type InvoiceItem } from "./billing-store";
import type { GstKind } from "./billing-store";

function makeId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto)
    return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

// ── Credit Note ──────────────────────────────────────────────────────────────

export type CreditDebitNoteStatus = "issued" | "cancelled";

export interface CreditNote {
  id: string;
  creditNoteNo: string;
  /** Absent for a standalone credit note issued without a linked invoice. */
  invoiceId?: string;
  invoiceNo?: string;
  customerId: string;
  customerName: string;
  amountPaise: number;
  goldFineMg: number;
  reason: string;
  status: CreditDebitNoteStatus;
  branchId?: string;
  createdAt: number;
  updatedAt: number;
}

const creditNoteRepository = createRepository<CreditNote>("credit_notes");

interface CreditNoteState {
  notes: CreditNote[];
  refresh: () => Promise<void>;
  issue: (
    input: Omit<CreditNote, "id" | "creditNoteNo" | "status" | "createdAt" | "updatedAt">,
    actor: { id: string | null; email: string | null },
  ) => Promise<CreditNote>;
  cancel: (id: string, actor: { id: string | null; email: string | null }) => Promise<void>;
  forInvoice: (invoiceId: string) => CreditNote[];
  reset: () => void;
}

export const useCreditNotes = create<CreditNoteState>()((set, get) => ({
  notes: [],
  refresh: async () => set({ notes: await creditNoteRepository.readAll() }),
  issue: async (input, actor) => {
    const now = Date.now();
    const note: CreditNote = {
      ...input,
      id: makeId("cn"),
      creditNoteNo: await getNextSequenceNumber("credit_note"),
      status: "issued",
      createdAt: now,
      updatedAt: now,
    };
    await creditNoteRepository.save(note);
    set((s) => ({ notes: [note, ...s.notes] }));
    await appendAuditEntry({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "credit_note.issued",
      entityType: "credit_notes",
      entityId: note.id,
      before: null,
      after: note,
      deviceId: null,
    });
    return note;
  },
  cancel: async (id, actor) => {
    const existing = get().notes.find((n) => n.id === id);
    if (!existing || existing.status === "cancelled") return;
    const updated: CreditNote = { ...existing, status: "cancelled", updatedAt: Date.now() };
    await creditNoteRepository.save(updated);
    set((s) => ({ notes: s.notes.map((n) => (n.id === id ? updated : n)) }));
    await appendAuditEntry({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "credit_note.cancelled",
      entityType: "credit_notes",
      entityId: id,
      before: existing,
      after: updated,
      deviceId: null,
    });
  },
  forInvoice: (invoiceId) => get().notes.filter((n) => n.invoiceId === invoiceId),
  reset: () => set({ notes: [] }),
}));

// ── Debit Note ───────────────────────────────────────────────────────────────

export interface DebitNote {
  id: string;
  debitNoteNo: string;
  /** Absent for a standalone debit note issued without a linked invoice. */
  invoiceId?: string;
  invoiceNo?: string;
  customerId: string;
  customerName: string;
  amountPaise: number;
  goldFineMg: number;
  reason: string;
  status: CreditDebitNoteStatus;
  branchId?: string;
  createdAt: number;
  updatedAt: number;
}

const debitNoteRepository = createRepository<DebitNote>("debit_notes");

interface DebitNoteState {
  notes: DebitNote[];
  refresh: () => Promise<void>;
  issue: (
    input: Omit<DebitNote, "id" | "debitNoteNo" | "status" | "createdAt" | "updatedAt">,
    actor: { id: string | null; email: string | null },
  ) => Promise<DebitNote>;
  cancel: (id: string, actor: { id: string | null; email: string | null }) => Promise<void>;
  forInvoice: (invoiceId: string) => DebitNote[];
  reset: () => void;
}

export const useDebitNotes = create<DebitNoteState>()((set, get) => ({
  notes: [],
  refresh: async () => set({ notes: await debitNoteRepository.readAll() }),
  issue: async (input, actor) => {
    const now = Date.now();
    const note: DebitNote = {
      ...input,
      id: makeId("dn"),
      debitNoteNo: await getNextSequenceNumber("debit_note"),
      status: "issued",
      createdAt: now,
      updatedAt: now,
    };
    await debitNoteRepository.save(note);
    set((s) => ({ notes: [note, ...s.notes] }));
    await appendAuditEntry({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "debit_note.issued",
      entityType: "debit_notes",
      entityId: note.id,
      before: null,
      after: note,
      deviceId: null,
    });
    return note;
  },
  cancel: async (id, actor) => {
    const existing = get().notes.find((n) => n.id === id);
    if (!existing || existing.status === "cancelled") return;
    const updated: DebitNote = { ...existing, status: "cancelled", updatedAt: Date.now() };
    await debitNoteRepository.save(updated);
    set((s) => ({ notes: s.notes.map((n) => (n.id === id ? updated : n)) }));
    await appendAuditEntry({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "debit_note.cancelled",
      entityType: "debit_notes",
      entityId: id,
      before: existing,
      after: updated,
      deviceId: null,
    });
  },
  forInvoice: (invoiceId) => get().notes.filter((n) => n.invoiceId === invoiceId),
  reset: () => set({ notes: [] }),
}));

// ── Estimate ─────────────────────────────────────────────────────────────────

export type EstimateStatus = "draft" | "converted" | "expired" | "cancelled";

export interface Estimate {
  id: string;
  estimateNo: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  items: InvoiceItem[];
  gst: GstKind;
  subtotalPaise: number;
  gstPaise: number;
  grandTotalPaise: number;
  validUntilIso?: string;
  status: EstimateStatus;
  convertedToInvoiceId?: string;
  branchId?: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

const estimateRepository = createRepository<Estimate>("estimates");

interface EstimateState {
  estimates: Estimate[];
  refresh: () => Promise<void>;
  create: (
    input: Omit<
      Estimate,
      "id" | "estimateNo" | "status" | "createdAt" | "updatedAt" | "convertedToInvoiceId"
    >,
  ) => Promise<Estimate>;
  cancel: (id: string) => Promise<void>;
  /** Real conversion — creates an actual Invoice (via useBilling.add) from the estimate's items, then marks the estimate converted and links it to the new invoice. Never both an "active estimate" and an unlinked invoice for the same sale. */
  convertToInvoice: (id: string) => Promise<{ invoiceId: string } | null>;
  reset: () => void;
}

export const useEstimates = create<EstimateState>()((set, get) => ({
  estimates: [],
  refresh: async () => set({ estimates: await estimateRepository.readAll() }),
  create: async (input) => {
    const now = Date.now();
    const estimate: Estimate = {
      ...input,
      id: makeId("est"),
      estimateNo: await getNextSequenceNumber("estimate"),
      status: "draft",
      createdAt: now,
      updatedAt: now,
    };
    await estimateRepository.save(estimate);
    set((s) => ({ estimates: [estimate, ...s.estimates] }));
    return estimate;
  },
  cancel: async (id) => {
    const existing = get().estimates.find((e) => e.id === id);
    if (!existing || existing.status !== "draft") return;
    const updated: Estimate = { ...existing, status: "cancelled", updatedAt: Date.now() };
    await estimateRepository.save(updated);
    set((s) => ({ estimates: s.estimates.map((e) => (e.id === id ? updated : e)) }));
  },
  convertToInvoice: async (id) => {
    const existing = get().estimates.find((e) => e.id === id);
    if (!existing || existing.status !== "draft") return null;

    const invoice = await useBilling.getState().add({
      customerId: existing.customerId,
      customerName: existing.customerName,
      customerPhone: existing.customerPhone,
      items: existing.items,
      gst: existing.gst,
      cgstPaise: 0,
      sgstPaise: 0,
      gstPaise: existing.gstPaise,
      subtotalPaise: existing.subtotalPaise,
      adjustmentPaise: 0,
      grandTotalPaise: existing.grandTotalPaise,
      paidPaise: 0,
      balancePaise: existing.grandTotalPaise,
      payments: [],
      status: "draft",
      branchId: existing.branchId,
      notes: `Converted from Estimate ${existing.estimateNo}`,
    } as any);

    const updated: Estimate = {
      ...existing,
      status: "converted",
      convertedToInvoiceId: invoice.id,
      updatedAt: Date.now(),
    };
    await estimateRepository.save(updated);
    set((s) => ({ estimates: s.estimates.map((e) => (e.id === id ? updated : e)) }));
    return { invoiceId: invoice.id };
  },
  reset: () => set({ estimates: [] }),
}));

// ── Delivery Challan ─────────────────────────────────────────────────────────

export type DeliveryChallanPurpose =
  "sale_on_approval" | "job_work" | "return" | "transfer" | "other";
export type DeliveryChallanStatus = "issued" | "returned" | "converted_to_invoice" | "cancelled";

export interface DeliveryChallanItem {
  itemName: string;
  category: string;
  grossMg: number;
  /** Net weight (gross minus stone/less weight). Equals grossMg for a manual entry with no order link. */
  netMg: number;
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
  purpose: DeliveryChallanPurpose;
  status: DeliveryChallanStatus;
  convertedToInvoiceId?: string;
  linkedOrderId?: string;
  branchId?: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

const challanRepository = createRepository<DeliveryChallan>("delivery_challans");

interface DeliveryChallanState {
  challans: DeliveryChallan[];
  refresh: () => Promise<void>;
  create: (
    input: Omit<
      DeliveryChallan,
      "id" | "challanNo" | "status" | "createdAt" | "updatedAt" | "convertedToInvoiceId"
    >,
  ) => Promise<DeliveryChallan>;
  markReturned: (id: string) => Promise<void>;
  cancel: (id: string) => Promise<void>;
  reset: () => void;
}

export const useDeliveryChallans = create<DeliveryChallanState>()((set, get) => ({
  challans: [],
  refresh: async () => set({ challans: await challanRepository.readAll() }),
  create: async (input) => {
    const now = Date.now();
    const challan: DeliveryChallan = {
      ...input,
      id: makeId("dc"),
      challanNo: await getNextSequenceNumber("delivery_challan"),
      status: "issued",
      createdAt: now,
      updatedAt: now,
    };
    await challanRepository.save(challan);
    set((s) => ({ challans: [challan, ...s.challans] }));
    return challan;
  },
  markReturned: async (id) => {
    const existing = get().challans.find((c) => c.id === id);
    if (!existing || existing.status !== "issued") return;
    const updated: DeliveryChallan = { ...existing, status: "returned", updatedAt: Date.now() };
    await challanRepository.save(updated);
    set((s) => ({ challans: s.challans.map((c) => (c.id === id ? updated : c)) }));
  },
  cancel: async (id) => {
    const existing = get().challans.find((c) => c.id === id);
    if (!existing || existing.status !== "issued") return;
    const updated: DeliveryChallan = { ...existing, status: "cancelled", updatedAt: Date.now() };
    await challanRepository.save(updated);
    set((s) => ({ challans: s.challans.map((c) => (c.id === id ? updated : c)) }));
  },
  reset: () => set({ challans: [] }),
}));
