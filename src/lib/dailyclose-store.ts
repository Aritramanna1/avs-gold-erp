/**
 * MTJ ERP — Daily Close store (Sprint 4)
 * Saves a snapshot of end-of-day totals + reconciliation checklist.
 */
import { create } from "zustand";
import { getNextSequenceSync } from "./sequence-manager";
import { createRepository } from "./repositories/base-repository";

export interface DailyCloseChecklist {
  cashCounted: boolean;
  goldChecked: boolean;
  pendingOrdersReviewed: boolean;
  karigarCustodyReviewed: boolean;
  printReportsSaved: boolean;
}

export interface DailyCloseSnapshot {
  // gold
  openingVaultMg: number;
  goldIssuedMg: number;
  goldReceivedMg: number;
  finishedCreatedMg: number;
  scrapReturnedMg: number;
  soldFineMg: number;
  closingVaultMg: number;
  karigarOutstandingMg: number;
  balanceSheetBalanced: boolean;
  discrepancyMg: number;
  // money (paise)
  invoiceCount: number;
  salesTotalPaise: number;
  cashTotalPaise: number;
  upiTotalPaise: number;
  bankTotalPaise: number;
  cardTotalPaise: number;
  outstandingTotalPaise: number;
  repairPaymentsPaise: number;
  workerWithdrawalsPaise: number;
  gstCollectedPaise: number;
  // workshop
  jobCardsCreated: number;
  jobCardsClosed: number;
  // repair
  repairsCreated: number;
  repairsDelivered: number;
}

export interface DailyClose {
  id: string;
  date: string; // YYYY-MM-DD
  createdAt: number;
  snapshot: DailyCloseSnapshot;
  checklist: DailyCloseChecklist;
  physicalCashCountedPaise: number;
  expectedCashPaise: number;
  cashVariancePaise: number;
  notes?: string;
  managerSignature?: string;
  ownerSignature?: string;
}

interface DailyCloseState {
  closes: DailyClose[];
  add: (c: Omit<DailyClose, "id" | "createdAt">) => DailyClose;
  remove: (id: string) => void;
  reset: () => void;
}

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `dc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const dailyCloseRepository = createRepository<DailyClose>("daily_close");

export const useDailyCloses = create<DailyCloseState>()((set, get) => ({
  closes: [],
  add: (input) => {
    const generatedId = getNextSequenceSync("daily_close");
    const c: DailyClose = { id: generatedId, createdAt: Date.now(), ...input };
    set({ closes: [c, ...get().closes] });
    void dailyCloseRepository.save(c);
    return c;
  },
  remove: (id) => {
    set({ closes: get().closes.filter((c) => c.id !== id) });
    void dailyCloseRepository.delete(id);
  },
  reset: () => set({ closes: [] }),
}));
