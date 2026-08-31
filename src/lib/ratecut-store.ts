/**
 * MTJ ERP — Rate-Cut / Overloss Settlement store (Sprint 3)
 *
 * When karigar overloss exceeds the allowed wastage, the supervisor converts
 * the gold loss into a cash penalty and decides how it is settled.
 *
 * Gold ledger rule (important):
 *   - Cash / salary-deduction / carry-forward / waive  → DO NOT touch gold ledger.
 *     The overloss gold was already removed at Receive Work; this is a money/HR
 *     settlement, not a second gold movement.
 *   - Only if actual gold is returned (future flow) we touch gold ledger.
 *
 * Money is stored as paise; gold as mg.
 */

import { create } from "zustand";
import { createRepository } from "./repositories/base-repository";
import { nextDocumentNumber } from "./document-numbering";

export type RateCutMode = "cash_received" | "salary_deduction" | "carry_forward" | "waived";

export const RATE_CUT_MODE_LABELS: Record<RateCutMode, string> = {
  cash_received: "Cash Received",
  salary_deduction: "Salary Deduction",
  carry_forward: "Carry Forward",
  waived: "Waived",
};

export interface RateCutRecord {
  id: string;
  slipNo: string;
  ts: number;

  karigarId: string;
  karigarName: string;

  jobId?: string;
  jobNo?: string;

  overlossFineMg: number;
  goldRatePerGramPaise: number; // ₹ per gram in paise
  penaltyValuePaise: number; // overloss × rate

  mode: RateCutMode;
  amountSettledPaise: number;
  remainingPaise: number; // penalty - amountSettled (for carry forward / waive)

  notes?: string;
  workerTxnId?: string; // optional link to worker transaction (salary deduction etc.)
}

interface RateCutState {
  records: RateCutRecord[];
  add: (
    r: Omit<RateCutRecord, "id" | "slipNo" | "ts"> & { id?: string; slipNo?: string; ts?: number },
  ) => Promise<RateCutRecord>;
  remove: (id: string) => void;
  reset: () => void;
}

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `rc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function makeSlipNo(): Promise<string> {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const prefix = `RC-${ymd}-`;
  return nextDocumentNumber(`ratecut:${ymd}`, prefix, 3);
}

const rateCutRepository = createRepository<RateCutRecord>("rate_cut_records");

export const useRateCuts = create<RateCutState>()((set, get) => ({
  records: [],
  add: async (input) => {
    const rec: RateCutRecord = {
      id: input.id ?? makeId(),
      slipNo: input.slipNo ?? (await makeSlipNo()),
      ts: input.ts ?? Date.now(),
      ...input,
    };
    set({ records: [rec, ...get().records] });
    void rateCutRepository.save(rec);
    return rec;
  },
  remove: (id) => {
    set({ records: get().records.filter((r) => r.id !== id) });
    void rateCutRepository.delete(id);
  },
  reset: () => set({ records: [] }),
}));

export function ratecutPenaltyPaise(overlossMg: number, ratePerGramPaise: number): number {
  // overlossMg / 1000 × ratePerGramPaise = paise
  return Math.round((overlossMg * ratePerGramPaise) / 1000);
}
