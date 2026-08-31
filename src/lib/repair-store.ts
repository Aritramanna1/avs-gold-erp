/**
 * MTJ ERP — Repair & Polishing store (Sprint 4)
 * Separate from manufacturing order flow.
 * Weights mg, money paise, purity per-mille.
 */
import { create } from "zustand";
import type { PaymentMode } from "./billing-store";
import { useSettings } from "./settings-store";
import { createRepository } from "./repositories/base-repository";

export type RepairKind = "repair" | "polishing";
export const REPAIR_KIND_LABELS: Record<RepairKind, string> = {
  repair: "Repair",
  polishing: "Polishing",
};

export type RepairStatus = "pending" | "in_work" | "ready" | "delivered" | "cancelled";
export const REPAIR_STATUS_LABELS: Record<RepairStatus, string> = {
  pending: "Pending",
  in_work: "In Work",
  ready: "Ready for Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export type RepairType =
  "soldering" | "resizing" | "stone_setting" | "chain_repair" | "polishing" | "rhodium" | "other";

export const REPAIR_TYPE_LABELS: Record<RepairType, string> = {
  soldering: "Soldering",
  resizing: "Resizing",
  stone_setting: "Stone Setting",
  chain_repair: "Chain Repair",
  polishing: "Polishing",
  rhodium: "Rhodium Plating",
  other: "Other",
};

export interface RepairPayment {
  id: string;
  ts: number;
  mode: PaymentMode;
  amountPaise: number;
  reference?: string;
  notes?: string;
}

export interface RepairTimelineEvent {
  ts: number;
  label: string;
  note?: string;
}

export interface Repair {
  id: string;
  repairNo: string;
  kind: RepairKind;
  createdAt: number;
  updatedAt: number;
  status: RepairStatus;

  customerId: string;
  customerName: string;
  customerPhone?: string;

  itemType: string;
  itemDescription: string;
  conditionNotes?: string;
  stoneFittingNotes?: string;
  receivedGrossMg: number;
  purity?: number;

  repairType: RepairType;
  workerId?: string;
  workerName?: string;
  expectedDelivery?: string;

  estimatedChargePaise: number;
  advancePaise: number;
  advanceMode?: PaymentMode;

  // Final billing
  finalChargePaise: number;
  polishingChargePaise: number;
  additionalChargePaise: number;
  gstEnabled: boolean;
  cgstPaise: number;
  sgstPaise: number;

  payments: RepairPayment[];
  deliveredAt?: number;

  notes?: string;
  branchId?: string;
  timeline: RepairTimelineEvent[];
}

interface RepairsState {
  repairs: Repair[];
  add: (
    r: Omit<
      Repair,
      | "createdAt"
      | "updatedAt"
      | "timeline"
      | "payments"
      | "finalChargePaise"
      | "polishingChargePaise"
      | "additionalChargePaise"
      | "cgstPaise"
      | "sgstPaise"
      | "gstEnabled"
    > & {
      id?: string;
      // Always caller-supplied via getNextSequenceNumber("repair") — atomic,
      // race-safe. No client-side "count existing + 1" fallback here.
      repairNo: string;
      gstEnabled?: boolean;
      payments?: RepairPayment[];
      timeline?: RepairTimelineEvent[];
    },
  ) => Repair;
  update: (id: string, patch: Partial<Repair>) => void;
  setStatus: (id: string, status: RepairStatus, note?: string) => void;
  addPayment: (
    id: string,
    p: Omit<RepairPayment, "id" | "ts"> & { ts?: number },
  ) => RepairPayment | null;
  remove: (id: string) => Promise<void>;
  reset: () => void;
}

function makeId(prefix = "rp") {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function computeRepairTotals(r: Repair): {
  baseChargePaise: number;
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  gstPaise: number;
  grandTotalPaise: number;
  paidPaise: number;
  balancePaise: number;
} {
  const baseChargePaise =
    (r.finalChargePaise || r.estimatedChargePaise) +
    r.polishingChargePaise +
    r.additionalChargePaise;
  const taxablePaise = baseChargePaise;
  const cgstPaise = r.gstEnabled ? Math.round((taxablePaise * 15) / 1000) : 0;
  const sgstPaise = r.gstEnabled ? Math.round((taxablePaise * 15) / 1000) : 0;
  const gstPaise = cgstPaise + sgstPaise;
  const grandTotalPaise = baseChargePaise + gstPaise;
  const paidPaise =
    r.advancePaise +
    r.payments.filter((p) => p.mode !== "outstanding").reduce((s, p) => s + p.amountPaise, 0);
  const balancePaise = grandTotalPaise - paidPaise;
  return {
    baseChargePaise,
    taxablePaise,
    cgstPaise,
    sgstPaise,
    gstPaise,
    grandTotalPaise,
    paidPaise,
    balancePaise,
  };
}

const repairRepository = createRepository<Repair>("repairs");

export const useRepairs = create<RepairsState>()((set, get) => ({
  repairs: [],
  add: (input) => {
    const now = Date.now();
    const repair: Repair = {
      branchId: (input as any).branchId ?? useSettings.getState().selectedBranchId ?? undefined,
      finalChargePaise: 0,
      polishingChargePaise: 0,
      additionalChargePaise: 0,
      cgstPaise: 0,
      sgstPaise: 0,
      ...input,
      id: (input as { id?: string }).id ?? makeId(),
      repairNo: input.repairNo,
      createdAt: now,
      updatedAt: now,
      gstEnabled: input.gstEnabled ?? false,
      payments: input.payments ?? [],
      timeline: input.timeline ?? [
        { ts: now, label: `${REPAIR_KIND_LABELS[input.kind]} intake created` },
      ],
    };
    set({ repairs: [repair, ...get().repairs] });
    void repairRepository.save(repair);
    return repair;
  },
  update: (id, patch) => {
    set({
      repairs: get().repairs.map((r) =>
        r.id === id ? { ...r, ...patch, updatedAt: Date.now() } : r,
      ),
    });
    const updated = get().repairs.find((r) => r.id === id);
    if (updated) void repairRepository.save(updated);
  },
  setStatus: (id, status, note) => {
    const now = Date.now();
    set({
      repairs: get().repairs.map((r) =>
        r.id === id
          ? {
              ...r,
              status,
              updatedAt: now,
              deliveredAt: status === "delivered" ? now : r.deliveredAt,
              timeline: [
                ...r.timeline,
                { ts: now, label: `Status → ${REPAIR_STATUS_LABELS[status]}`, note },
              ],
            }
          : r,
      ),
    });
    const updated = get().repairs.find((r) => r.id === id);
    if (updated) void repairRepository.save(updated);

    // Event-driven communication automation (Plan 1 Step 9) — repair_update
    // fires on every status change; "ready" additionally reuses the same
    // event (repair_update maps to the "repair_ready" template today — a
    // dedicated ready-vs-general-update distinction is a documented follow-up).
    if (updated) {
      import("@/lib/comm/comm-automation")
        .then(({ emitBusinessEvent }) =>
          emitBusinessEvent("repair_update", {
            branchId: updated.branchId ?? "default",
            recipient: { name: updated.customerName, phone: updated.customerPhone },
            linkedId: updated.id,
            linkedType: "repair",
          }),
        )
        .catch((err) => console.error("[Repair] repair_update automation failed:", err));
    }
  },
  addPayment: (id, p) => {
    const r = get().repairs.find((x) => x.id === id);
    if (!r) return null;
    const pay: RepairPayment = {
      id: makeId("pay"),
      ts: p.ts ?? Date.now(),
      mode: p.mode,
      amountPaise: p.amountPaise,
      reference: p.reference,
      notes: p.notes,
    };
    set({
      repairs: get().repairs.map((x) =>
        x.id === id
          ? {
              ...x,
              payments: [...x.payments, pay],
              updatedAt: Date.now(),
              timeline: [
                ...x.timeline,
                {
                  ts: pay.ts,
                  label: `Payment received`,
                  note: `${p.mode} · ${(p.amountPaise / 100).toFixed(2)}`,
                },
              ],
            }
          : x,
      ),
    });
    const updated = get().repairs.find((x) => x.id === id);
    if (updated) void repairRepository.save(updated);
    return pay;
  },
  remove: async (id) => {
    // Backend delete must succeed before the record disappears locally —
    // otherwise a failed delete leaves the repair silently reappearing on
    // the next sync/reload while the user believes it's gone (same class of
    // bug already fixed in orders/stock/people/jobcards-store).
    await repairRepository.delete(id);
    set({ repairs: get().repairs.filter((r) => r.id !== id) });
  },
  reset: () => set({ repairs: [] }),
}));
