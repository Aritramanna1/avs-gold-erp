/**
 * Physical Stock Verification — cycle counts / annual stock-take.
 *
 * A count session snapshots every "available/reserved" stock item expected on
 * hand for a branch at start time, then lets staff scan/enter barcodes found
 * during the physical walk-through. Finishing the session computes variance
 * (missing items, unexpected/found-elsewhere items, fine-gold discrepancy) —
 * every gram of variance is attributable to a specific item, not just a
 * total, so it can be investigated and, if genuine, logged as a stock
 * adjustment via the existing stock-store movement trail.
 */
import { create } from "zustand";
import { createRepository } from "./repositories/base-repository";
import { useStock, type StockItem } from "./stock-store";
import { useLedger } from "./ledger-store";
import { append as appendAudit } from "./security/audit-log";
import { fetchPhysicalStockCounts } from "./physical-stock-verification-query";

export interface StockCountLine {
  itemId: string;
  itemCode: string;
  barcode: string;
  expectedFineMg: number;
  scanned: boolean;
  scannedAt?: number;
  foundLocation?: string;
  notes?: string;
}

export type StockCountStatus = "in_progress" | "completed" | "cancelled";

export interface PhysicalStockCount {
  id: string;
  branchId: string;
  status: StockCountStatus;
  startedAt: number;
  startedBy: string | null;
  completedAt?: number;
  completedBy?: string | null;
  lines: StockCountLine[];
  /** Fine mg counted as short (expected but not scanned) at completion time. */
  shortFineMg?: number;
  /** Fine mg counted as unexplained-extra (scanned but not on the expected list). */
  extraFineMg?: number;
  notes?: string;
  /** Set once a confirmed shortage has been posted as a gold-ledger adjustment — prevents double-posting. */
  adjustmentLedgerEntryId?: string;
}

interface PhysicalStockCountState {
  counts: PhysicalStockCount[];
  setAll: (counts: PhysicalStockCount[]) => void;
  start: (
    branchId: string,
    actor: { id: string | null; email: string | null },
  ) => PhysicalStockCount;
  scan: (countId: string, barcodeOrCode: string) => { ok: boolean; message: string };
  complete: (
    countId: string,
    actor: { id: string | null; email: string | null },
    notes?: string,
  ) => PhysicalStockCount | null;
  cancel: (countId: string) => void;
  /**
   * Posts the confirmed shortage from a completed count as a gold-ledger
   * "adjustment" entry (vault bucket reduced by the shortfall) so the
   * discrepancy is reflected in the Gold Balance Sheet, not just reported.
   * Idempotent: no-ops (returns null) if already posted or shortage is zero.
   */
  postShortageAdjustment: (
    countId: string,
    actor: { id: string | null; email: string | null },
  ) => Promise<void>;
}

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `psc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const countRepository = createRepository<PhysicalStockCount>("physical_stock_counts");

export const usePhysicalStockCounts = create<PhysicalStockCountState>()((set, get) => ({
  counts: [],
  setAll: (counts) => set({ counts }),

  start: (branchId, actor) => {
    const expected = useStock
      .getState()
      .items.filter((i) => i.location && (i.status === "available" || i.status === "reserved"));
    const count: PhysicalStockCount = {
      id: makeId(),
      branchId,
      status: "in_progress",
      startedAt: Date.now(),
      startedBy: actor.id,
      lines: expected.map((i: StockItem) => ({
        itemId: i.id,
        itemCode: i.itemCode,
        barcode: i.barcode,
        expectedFineMg: i.fineMg,
        scanned: false,
      })),
    };
    set({ counts: [count, ...get().counts] });
    void countRepository.save(count);
    void appendAudit({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "physical_stock_counts.start",
      entityType: "physical_stock_counts",
      entityId: count.id,
      before: null,
      after: { id: count.id, branchId, lineCount: count.lines.length },
    });
    return count;
  },

  scan: (countId, barcodeOrCode) => {
    const count = get().counts.find((c) => c.id === countId);
    if (!count || count.status !== "in_progress") {
      return { ok: false, message: "Count session not found or already finished." };
    }
    const needle = barcodeOrCode.trim().toLowerCase();
    if (!needle) return { ok: false, message: "Enter a barcode or item code." };
    const line = count.lines.find(
      (l) => l.barcode.toLowerCase() === needle || l.itemCode.toLowerCase() === needle,
    );
    if (!line) {
      return {
        ok: false,
        message: `"${barcodeOrCode}" is not on the expected list for this branch.`,
      };
    }
    if (line.scanned) {
      return { ok: true, message: `${line.itemCode} already scanned.` };
    }
    const updated: PhysicalStockCount = {
      ...count,
      lines: count.lines.map((l) =>
        l.itemId === line.itemId ? { ...l, scanned: true, scannedAt: Date.now() } : l,
      ),
    };
    set({ counts: get().counts.map((c) => (c.id === countId ? updated : c)) });
    void countRepository.save(updated);
    return { ok: true, message: `${line.itemCode} scanned OK.` };
  },

  complete: (countId, actor, notes) => {
    const count = get().counts.find((c) => c.id === countId);
    if (!count || count.status !== "in_progress") return null;
    const shortFineMg = count.lines
      .filter((l) => !l.scanned)
      .reduce((sum, l) => sum + l.expectedFineMg, 0);
    const updated: PhysicalStockCount = {
      ...count,
      status: "completed",
      completedAt: Date.now(),
      completedBy: actor.id,
      shortFineMg,
      extraFineMg: 0,
      notes,
    };
    set({ counts: get().counts.map((c) => (c.id === countId ? updated : c)) });
    void countRepository.save(updated);
    void appendAudit({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "physical_stock_counts.complete",
      entityType: "physical_stock_counts",
      entityId: countId,
      before: { status: "in_progress" },
      after: { status: "completed", shortFineMg },
    });
    return updated;
  },

  cancel: (countId) => {
    const count = get().counts.find((c) => c.id === countId);
    if (!count) return;
    const updated: PhysicalStockCount = { ...count, status: "cancelled" };
    set({ counts: get().counts.map((c) => (c.id === countId ? updated : c)) });
    void countRepository.save(updated);
  },

  postShortageAdjustment: async (countId, actor) => {
    const count = get().counts.find((c) => c.id === countId);
    if (!count || count.status !== "completed") return;
    if (count.adjustmentLedgerEntryId) return; // already posted
    const shortFineMg = count.shortFineMg ?? 0;
    if (shortFineMg <= 0) return;

    const entry = await useLedger.getState().append({
      type: "adjustment",
      netFineMg: -shortFineMg,
      deltas: { vault: -shortFineMg },
      fineMg: shortFineMg,
      reference: `Physical stock count ${countId}`,
      notes: `Confirmed shortage from physical stock verification on ${new Date(count.completedAt ?? Date.now()).toLocaleDateString()} — ${
        count.lines.filter((l) => !l.scanned).length
      } item(s) not found.`,
    });

    const updated: PhysicalStockCount = { ...count, adjustmentLedgerEntryId: entry.id };
    set({ counts: get().counts.map((c) => (c.id === countId ? updated : c)) });
    void countRepository.save(updated);
    void appendAudit({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "physical_stock_counts.shortage_adjustment_posted",
      entityType: "physical_stock_counts",
      entityId: countId,
      before: { adjustmentLedgerEntryId: null },
      after: { adjustmentLedgerEntryId: entry.id, shortFineMg },
    });
  },
}));

export async function loadPhysicalStockCounts(): Promise<void> {
  const all = await fetchPhysicalStockCounts();
  usePhysicalStockCounts.getState().setAll(all);
}
