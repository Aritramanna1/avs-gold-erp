/**
 * AVS ERP — Authoritative Karigar Transaction Hub
 *
 * Universal transaction engine for all interactions with Karigars, workers, and external processors.
 * Supported Transaction Types:
 * - Gold Issue (Raw / Material / Patla / Wire)
 * - Gold Return (Finished / Semi-finished / Scrap)
 * - Advance (Cash / Gold)
 * - Withdrawal (Cash / Gold)
 * - Record Over-Loss (Posts directly to worker loss & ledger)
 * - Wastage Adjustment
 * - Chain Deduction / Return
 * - Process Work (Polishing, Cutting, Meena, Setting, Finishing, Plating, Y-out, Custom Process)
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useLedger } from "@/lib/ledger-store";
import { gramsToMg, fineGoldMg, parsePurity } from "@/lib/gold";
import { toast } from "sonner";

export type KarigarTransactionType =
  | "gold_issue"
  | "gold_return"
  | "advance_cash"
  | "advance_gold"
  | "withdrawal_cash"
  | "withdrawal_gold"
  | "record_over_loss"
  | "wastage_adjustment"
  | "chain_adjustment"
  | "process_polishing"
  | "process_cutting"
  | "process_meena"
  | "process_setting"
  | "process_plating"
  | "process_yout"
  | "process_custom";

export const KARIGAR_TXN_TYPE_LABELS: Record<KarigarTransactionType, string> = {
  gold_issue: "Gold Issue (Material to Karigar)",
  gold_return: "Gold Return (Received from Karigar)",
  advance_cash: "Cash Advance",
  advance_gold: "Gold Advance",
  withdrawal_cash: "Cash Withdrawal",
  withdrawal_gold: "Gold Withdrawal",
  record_over_loss: "Record Over-Loss (Process Loss)",
  wastage_adjustment: "Wastage Adjustment",
  chain_adjustment: "Chain Deduction / Return",
  process_polishing: "Polishing Work",
  process_cutting: "Die / Wire Cutting Work",
  process_meena: "Meena / Enameling Work",
  process_setting: "Diamond / Stone Setting Work",
  process_plating: "Rhodium / Gold Plating",
  process_yout: "Y-Out External Work",
  process_custom: "Custom Process Work",
};

export interface KarigarTransaction {
  id: string;
  transactionCode: string; // e.g. KT-2026-00412
  karigarId: string;
  karigarName: string;
  type: KarigarTransactionType;
  date: string; // YYYY-MM-DD
  grossMg: number;
  purity: number; // e.g. 916
  fineMg: number;
  cashAmountPaise: number;
  laborChargesPaise: number;
  chainWeightMg?: number;
  chainDeductionMg?: number;
  processName?: string;
  reasonOrNarration: string;
  referenceDocNo?: string;
  ledgerEntryId?: string;
  createdBy: string;
  createdAt: string;
}

interface KarigarTransactionHubState {
  transactions: KarigarTransaction[];
  addTransaction: (
    txn: Omit<KarigarTransaction, "id" | "transactionCode" | "createdAt" | "ledgerEntryId">,
  ) => Promise<KarigarTransaction>;
  getTransactionsByKarigar: (karigarId: string) => KarigarTransaction[];
  getKarigarBalanceSummary: (karigarId: string) => {
    totalGoldIssuedMg: number;
    totalGoldReturnedMg: number;
    totalOverLossMg: number;
    totalWastageMg: number;
    netGoldOutstandingMg: number;
    totalCashAdvancePaise: number;
    totalCashWithdrawnPaise: number;
    totalGoldWithdrawnMg: number;
    totalLaborEarnedPaise: number;
    netPayableCashPaise: number;
  };
}

export const useKarigarTransactionHub = create<KarigarTransactionHubState>()(
  persist(
    (set, get) => ({
      transactions: [
        {
          id: "kt-sample-1",
          transactionCode: "KT-2026-000101",
          karigarId: "karigar_1",
          karigarName: "Master Karigar Bimal",
          type: "gold_issue",
          date: "2026-09-01",
          grossMg: 50000, // 50.00g
          purity: 916,
          fineMg: 45800, // 45.80g
          cashAmountPaise: 0,
          laborChargesPaise: 0,
          reasonOrNarration: "Issue for 22K Antique Kada crafting",
          createdBy: "Showroom Manager",
          createdAt: "2026-09-01T10:00:00Z",
        },
        {
          id: "kt-sample-2",
          transactionCode: "KT-2026-000102",
          karigarId: "karigar_1",
          karigarName: "Master Karigar Bimal",
          type: "record_over_loss",
          date: "2026-09-05",
          grossMg: 450, // 0.450g over-loss
          purity: 916,
          fineMg: 412,
          cashAmountPaise: 0,
          laborChargesPaise: 0,
          reasonOrNarration: "Excess loss during die soldering & filigree polishing",
          createdBy: "Showroom Manager",
          createdAt: "2026-09-05T16:00:00Z",
        },
      ],

      addTransaction: async (txn) => {
        const id = `KT-${Date.now()}`;
        const transactionCode = `KT-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`;
        const createdAt = new Date().toISOString();

        // 1. Post to authoritative Ledger
        const appendLedger = useLedger.getState().append;
        let ledgerDeltaVault = 0;
        let ledgerDeltaWorker = 0;

        if (txn.type === "gold_issue") {
          ledgerDeltaVault = -txn.fineMg;
          ledgerDeltaWorker = txn.fineMg;
        } else if (txn.type === "gold_return") {
          ledgerDeltaVault = txn.fineMg;
          ledgerDeltaWorker = -txn.fineMg;
        } else if (txn.type === "record_over_loss") {
          ledgerDeltaWorker = -txn.fineMg; // Reduces worker gold balance as accounted loss
        } else if (txn.type === "withdrawal_gold") {
          ledgerDeltaVault = -txn.fineMg;
        }

        let movementType: "overloss" | "issue_to_karigar" | "receive_from_karigar" | "adjustment" = "adjustment";
        if (txn.type === "record_over_loss") movementType = "overloss";
        else if (txn.type === "gold_issue") movementType = "issue_to_karigar";
        else if (txn.type === "gold_return") movementType = "receive_from_karigar";

        const ledgerRes = await appendLedger({
          type: movementType,
          netFineMg: ledgerDeltaVault,
          deltas: {
            vault: ledgerDeltaVault,
            karigar: ledgerDeltaWorker,
          },
          grossMg: txn.grossMg,
          purity: txn.purity,
          fineMg: txn.fineMg,
          notes: `[Karigar Hub: ${KARIGAR_TXN_TYPE_LABELS[txn.type]}] ${txn.reasonOrNarration}`,
          source: "karigar_hub",
          reference: transactionCode,
        });

        const newRecord: KarigarTransaction = {
          ...txn,
          id,
          transactionCode,
          createdAt,
          ledgerEntryId: ledgerRes?.id,
        };

        set((state) => ({
          transactions: [newRecord, ...state.transactions],
        }));

        toast.success(`Karigar transaction ${transactionCode} recorded & posted to ledger.`);
        return newRecord;
      },

      getTransactionsByKarigar: (karigarId: string) => {
        return get().transactions.filter((t) => t.karigarId === karigarId);
      },

      getKarigarBalanceSummary: (karigarId: string) => {
        const txns = get().transactions.filter((t) => t.karigarId === karigarId);
        let totalGoldIssuedMg = 0;
        let totalGoldReturnedMg = 0;
        let totalOverLossMg = 0;
        let totalWastageMg = 0;
        let totalCashAdvancePaise = 0;
        let totalCashWithdrawnPaise = 0;
        let totalGoldWithdrawnMg = 0;
        let totalLaborEarnedPaise = 0;

        for (const t of txns) {
          if (t.type === "gold_issue") totalGoldIssuedMg += t.fineMg;
          if (t.type === "gold_return") totalGoldReturnedMg += t.fineMg;
          if (t.type === "record_over_loss") totalOverLossMg += t.fineMg;
          if (t.type === "wastage_adjustment") totalWastageMg += t.fineMg;
          if (t.type === "advance_cash") totalCashAdvancePaise += t.cashAmountPaise;
          if (t.type === "withdrawal_cash") totalCashWithdrawnPaise += t.cashAmountPaise;
          if (t.type === "withdrawal_gold") totalGoldWithdrawnMg += t.fineMg;
          if (t.type.startsWith("process_")) totalLaborEarnedPaise += t.laborChargesPaise;
        }

        const netGoldOutstandingMg =
          totalGoldIssuedMg - totalGoldReturnedMg - totalOverLossMg - totalWastageMg - totalGoldWithdrawnMg;
        const netPayableCashPaise = totalLaborEarnedPaise - totalCashAdvancePaise - totalCashWithdrawnPaise;

        return {
          totalGoldIssuedMg,
          totalGoldReturnedMg,
          totalOverLossMg,
          totalWastageMg,
          netGoldOutstandingMg,
          totalCashAdvancePaise,
          totalCashWithdrawnPaise,
          totalGoldWithdrawnMg,
          totalLaborEarnedPaise,
          netPayableCashPaise,
        };
      },
    }),
    {
      name: "avs_karigar_transaction_hub_v1",
    },
  ),
);
