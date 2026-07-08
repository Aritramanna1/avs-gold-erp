/**
 * Manufacturing Mode Barcode & Tagging — the finished-product identity
 * system. NOT the retail/inventory barcode in stock-store.ts (that stays
 * untouched and unrelated). A ManufacturingBarcode is issued once, after
 * Worker Return and Polishing are both complete for a Production Order, and
 * its four identity fields (barcode number, QR code, internal product ID,
 * tag number) never change afterward — see `generate()`'s duplicate guard.
 *
 * Vault integration: generation posts exactly one `finished_item_created`
 * Gold Ledger movement crediting the `finished` bucket — the formal moment
 * this specific physical piece becomes tracked finished-goods inventory,
 * distinct from (and not double-counting) any provisional `finished`-bucket
 * credit Worker Return or Polishing Receive may already have posted for the
 * same order, which is why generation checks `!existingForOrder` first: at
 * most one barcode (one ledger credit) per order.
 */
import { create } from "zustand";
import { createRepository } from "./repositories/base-repository";
import { append as appendAuditEntry } from "./security/audit-log";
import { nextDocumentNumber } from "./document-numbering";
import { useOrderIssues } from "./order-issue-store";
import { useWorkerReturns, computeGoldPosition } from "./worker-return-store";
import { usePolishing } from "./polishing-store";
import { useLedger } from "./ledger-store";
import { useBarcodeConfig } from "./barcode-config-store";
import type { Order } from "./orders-store";

export type BarcodeStatus =
  "created" | "ready_for_tag" | "tagged" | "ready_for_delivery" | "delivered" | "returned";

export const BARCODE_STATUS_LABELS: Record<BarcodeStatus, string> = {
  created: "Created",
  ready_for_tag: "Ready for Tag",
  tagged: "Tagged",
  ready_for_delivery: "Ready for Delivery",
  delivered: "Delivered",
  returned: "Returned",
};

/** The only forward transitions allowed — status never skips backward except the reserved (not-yet-implemented) "returned" stage. */
const STATUS_ORDER: BarcodeStatus[] = [
  "created",
  "ready_for_tag",
  "tagged",
  "ready_for_delivery",
  "delivered",
  "returned",
];

export interface ManufacturingBarcode {
  id: string;
  /** Permanent, never regenerated. */
  barcodeNumber: string;
  /** Permanent — JSON or URL payload per barcode-config-store's qrFormat, encodes barcodeNumber + verification data. */
  qrCode: string;
  /** Permanent — internal cross-reference id, independent of the printable barcode number. */
  internalProductId: string;
  /** Permanent — physical tag number (may equal barcodeNumber for simple setups, kept separate since a shop may re-tag without reissuing identity). */
  tagNumber: string;

  orderId: string;
  orderNo: string;
  customerId: string;
  customerName: string;
  productDescription: string;
  category: string;
  grossMg: number;
  netMg: number;
  purity: number;
  fineMg: number;
  pieces: number;
  manufacturingDate: string; // YYYY-MM-DD
  status: BarcodeStatus;

  ledgerEntryId?: string;
  createdAt: number;
  updatedAt: number;
  createdBy?: string | null;

  // ── Reserved extension points — documented, NOT populated this phase ───
  settlementId?: string;
  gstInvoiceId?: string;
  rfidTag?: string;
  huid?: string;
  hallmarkApiRef?: string;
  customerPortalVisible?: boolean;
  mobileScannerRef?: string;
  warehouseLocationId?: string;
}

export interface EligibilityResult {
  eligible: boolean;
  reason?: string;
  workerReturnComplete: boolean;
  polishingComplete: boolean;
  alreadyGenerated: boolean;
}

/** Worker Return is "complete" once every gram issued to a worker for this order has been accounted for by a return. */
export function isWorkerReturnComplete(orderId: string): boolean {
  const issues = useOrderIssues.getState().issues.filter((i) => i.orderId === orderId);
  if (issues.length === 0) return false;
  const returns = useWorkerReturns.getState().returns.filter((r) => r.orderId === orderId);
  const issuedFineMg = issues.reduce((s, i) => s + i.fineMg, 0);
  return computeGoldPosition(issuedFineMg, returns).pendingFineMg <= 0;
}

/**
 * "Has every Send for this order been matched by a Receive" — true whether
 * polishing was ever sent or not. On its own this says nothing about
 * whether polishing actually HAPPENED, only that nothing is left hanging;
 * `checkEligibility` below is what decides whether polishing having never
 * been sent at all should count as "done" (only when the module's
 * `require_polishing_before_barcode` gate is off).
 */
export function isPolishingComplete(orderId: string): boolean {
  const txs = usePolishing.getState().transactions.filter((t) => t.orderId === orderId);
  const sent = txs.filter((t) => t.type === "sent").length;
  const received = txs.filter((t) => t.type === "received").length;
  return sent === 0 || received >= sent;
}

export function checkEligibility(
  orderId: string,
  requirePolishing: boolean,
  existingForOrder: ManufacturingBarcode[],
): EligibilityResult {
  const workerReturnComplete = isWorkerReturnComplete(orderId);
  const txs = usePolishing.getState().transactions.filter((t) => t.orderId === orderId);
  const polishingSent = txs.some((t) => t.type === "sent");
  const polishingReturnsMatched = isPolishingComplete(orderId);
  // When the gate is ON, polishing must genuinely have happened (sent AND
  // fully received) — "never sent" must NOT count as vacuously satisfied,
  // or the gate would be meaningless. When the gate is OFF, an order that
  // never went to polishing at all is fine; one that started polishing
  // still must finish it before a barcode is issued.
  const polishingComplete = requirePolishing
    ? polishingSent && polishingReturnsMatched
    : polishingReturnsMatched;
  const alreadyGenerated = existingForOrder.length > 0;

  if (alreadyGenerated) {
    return {
      eligible: false,
      reason: "A barcode has already been generated for this order — identity is permanent.",
      workerReturnComplete,
      polishingComplete,
      alreadyGenerated,
    };
  }
  if (!workerReturnComplete) {
    return {
      eligible: false,
      reason: "Worker Return is not yet complete for this order.",
      workerReturnComplete,
      polishingComplete,
      alreadyGenerated,
    };
  }
  if (requirePolishing && !polishingComplete) {
    return {
      eligible: false,
      reason: "Polishing is not yet complete for this order.",
      workerReturnComplete,
      polishingComplete,
      alreadyGenerated,
    };
  }
  return { eligible: true, workerReturnComplete, polishingComplete, alreadyGenerated };
}

const barcodeRepository = createRepository<ManufacturingBarcode>("manufacturing_barcodes");

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `mbc_${crypto.randomUUID()}`;
  return `mbc_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function buildIdentityNumbers(): Promise<{
  barcodeNumber: string;
  tagNumber: string;
  internalProductId: string;
}> {
  const config = useBarcodeConfig.getState().config;
  // Atomic, concurrency-safe — next_document_number() is a single
  // INSERT...ON CONFLICT DO UPDATE...RETURNING against the shared
  // document_sequences table, so two simultaneous barcode generations can
  // never receive the same number (the previous "query the highest existing
  // number, then +1" approach had exactly that race).
  const raw = await nextDocumentNumber(`barcode:${config.prefix}`, "", config.numberLength);
  const seq = raw.padStart(config.numberLength, "0").slice(-config.numberLength);
  const barcodeNumber = `${config.prefix}${seq}`;
  return {
    barcodeNumber,
    tagNumber: barcodeNumber,
    internalProductId: `IPID-${seq}`,
  };
}

interface ManufacturingBarcodeState {
  barcodes: ManufacturingBarcode[];
  refresh: () => Promise<void>;
  forOrder: (orderId: string) => ManufacturingBarcode[];
  findByBarcodeNumber: (code: string) => ManufacturingBarcode | undefined;
  generate: (
    order: Order,
    customerName: string,
    input: {
      productDescription: string;
      category: string;
      grossMg: number;
      netMg: number;
      purity: number;
      fineMg: number;
      pieces: number;
    },
    actor: { id: string | null; email: string | null },
  ) => Promise<ManufacturingBarcode>;
  advanceStatus: (
    id: string,
    status: BarcodeStatus,
    actor: { id: string | null; email: string | null },
  ) => Promise<void>;
  reset: () => void;
}

// Module-level (not store state) in-flight guard — a synchronous check-and-
// set BEFORE any `await`, so two overlapping generate() calls for the same
// order (a double-click before React's `disabled` state has re-rendered,
// or two independent callers racing) can't both pass the eligibility check
// while the first call's write is still in flight. Component-local
// `generating` state alone can't close this gap: it only prevents a second
// click AFTER a re-render has happened, not the window between the first
// click and that re-render.
const generationInFlight = new Set<string>();

export const useManufacturingBarcodes = create<ManufacturingBarcodeState>()((set, get) => ({
  barcodes: [],
  // Deliberately bypasses barcodeRepository.readAll()'s local-first cache:
  // that helper only re-pulls from Supabase when the local cache is
  // completely empty, so a barcode generated moments ago (written straight
  // to Supabase by generate(), never through the local write path) stays
  // invisible after a full page reload once any earlier row has been
  // cached locally. Barcode identity lookups (the scanner desk in
  // particular) need to always see the latest row, so query Supabase
  // directly here — the same freshness-over-cache tradeoff ledger-store.ts's
  // refresh() already makes for the same reason.
  refresh: async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data, error } = await supabase.from("manufacturing_barcodes" as any).select("data");
    if (error) {
      console.error("Error fetching manufacturing barcodes:", error);
      return;
    }
    const rows = (data ?? [])
      .map((r: any) => r.data as ManufacturingBarcode | null)
      .filter((b: ManufacturingBarcode | null): b is ManufacturingBarcode => !!b && !!b.id);
    set({ barcodes: rows });
  },
  forOrder: (orderId) => get().barcodes.filter((b) => b.orderId === orderId),
  findByBarcodeNumber: (code) =>
    get().barcodes.find(
      (b) => b.barcodeNumber === code || b.tagNumber === code || b.internalProductId === code,
    ),

  generate: async (order, customerName, input, actor) => {
    if (generationInFlight.has(order.id)) {
      throw new Error("A barcode generation for this order is already in progress.");
    }
    generationInFlight.add(order.id);
    try {
      const existingForOrder = get().forOrder(order.id);
      const requirePolishing = (await import("./business-rules-store")).useBusinessRules
        .getState()
        .isEnabled("require_polishing_before_barcode");
      const eligibility = checkEligibility(order.id, requirePolishing, existingForOrder);
      if (!eligibility.eligible) {
        throw new Error(eligibility.reason ?? "Not eligible for barcode generation.");
      }

      const { barcodeNumber, tagNumber, internalProductId } = await buildIdentityNumbers();
      const config = useBarcodeConfig.getState().config;
      const manufacturingDate = new Date().toISOString().split("T")[0];

      const qrPayload =
        config.qrFormat === "url"
          ? `${typeof window !== "undefined" ? window.location.origin : ""}/verify?barcode=${barcodeNumber}`
          : JSON.stringify({
              type: "manufacturing_barcode",
              barcodeNumber,
              orderId: order.id,
              orderNo: order.orderNo,
            });

      // Vault integration: exactly one finished_item_created credit per
      // barcode (== per order, since generate() is single-shot per order).
      const ledgerEntry = await useLedger.getState().append({
        type: "finished_item_created",
        netFineMg: 0,
        deltas: {},
        grossMg: input.grossMg,
        purity: input.purity,
        fineMg: input.fineMg,
        reference: barcodeNumber,
        notes: `Finished goods identity created for ${input.productDescription} · Order ${order.orderNo} · Barcode ${barcodeNumber}`,
      });

      const barcode: ManufacturingBarcode = {
        id: makeId(),
        barcodeNumber,
        qrCode: qrPayload,
        internalProductId,
        tagNumber,
        orderId: order.id,
        orderNo: order.orderNo,
        customerId: order.customerId,
        customerName,
        productDescription: input.productDescription,
        category: input.category,
        grossMg: input.grossMg,
        netMg: input.netMg,
        purity: input.purity,
        fineMg: input.fineMg,
        pieces: input.pieces,
        manufacturingDate,
        status: "created",
        ledgerEntryId: ledgerEntry.id,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: actor.email,
      };

      await barcodeRepository.save(barcode);
      set((s) => ({ barcodes: [barcode, ...s.barcodes] }));

      await appendAuditEntry({
        actorId: actor.id,
        actorEmail: actor.email,
        action: "manufacturing_barcode.generated",
        entityType: "manufacturing_barcodes",
        entityId: barcode.id,
        before: null,
        after: barcode,
        deviceId: null,
      });

      // Order Timeline integration — dynamic import avoids a module-level
      // circular dependency with orders-store.ts, same pattern already used
      // by material-vault-store.ts's conversion→timeline link.
      const { useOrders: useOrdersLive } = await import("./orders-store");
      await useOrdersLive.getState().appendTimeline(order.id, {
        ts: Date.now(),
        label: "Barcode Generated",
        note: `${barcodeNumber} · ${input.productDescription}`,
      });

      return barcode;
    } finally {
      generationInFlight.delete(order.id);
    }
  },

  advanceStatus: async (id, status, actor) => {
    const existing = get().barcodes.find((b) => b.id === id);
    if (!existing) return;
    const currentIdx = STATUS_ORDER.indexOf(existing.status);
    const nextIdx = STATUS_ORDER.indexOf(status);
    if (nextIdx <= currentIdx) return; // no-op: forward-only, no duplicate/backward transitions
    const updated: ManufacturingBarcode = { ...existing, status, updatedAt: Date.now() };
    await barcodeRepository.save(updated);
    set((s) => ({ barcodes: s.barcodes.map((b) => (b.id === id ? updated : b)) }));
    await appendAuditEntry({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "manufacturing_barcode.status_changed",
      entityType: "manufacturing_barcodes",
      entityId: id,
      before: { status: existing.status },
      after: { status },
      deviceId: null,
    });
  },

  reset: () => set({ barcodes: [] }),
}));
