/**
 * AVS ERP — Authoritative Karigar Settlement & Merged Withdrawal Engine
 *
 * Authoritative Calculation Formula:
 * Gross Salary Earned
 * Less: Withdrawals (Cash / Gold)
 * Less: Advance Balance
 * Less: Loan Balance
 * Less: Applicable Gold Advance
 * Less: Wastage / other applicable deductions
 * Less: Chain-related deduction / return
 * = Net Payable / Net Gold to be Paid
 *
 * Supports Settlement in Gold and Cash Settlement against Gold obligations.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useLedger } from "@/lib/ledger-store";
import { getCurrentGoldRatePaise } from "@/lib/bullion-rate-service";
import { toast } from "sonner";

export interface KarigarWithdrawalRecord {
  id: string;
  withdrawalCode: string;
  date: string;
  type: "Gold Withdrawal" | "Cash Withdrawal";
  amountPaise: number;
  weightMg: number;
  referenceDocNo: string;
  notes?: string;
  createdAt: string;
}

export interface KarigarSettlementRecord {
  id: string;
  settlementNumber: string; // e.g. AVS-KST-2026-0089
  karigarId: string;
  karigarName: string;
  settlementPeriod: string; // e.g. "Aug 2026" or "2026-09-01 to 2026-09-06"
  grossSalaryEarnedPaise: number;
  totalCashWithdrawalsPaise: number;
  totalGoldWithdrawalsMg: number;
  advanceBalancePaise: number;
  loanBalancePaise: number;
  goldAdvanceMg: number;
  wastageDeductionMg: number;
  chainDeductionMg: number;
  netPayableCashPaise: number;
  netGoldToBePaidMg: number;
  settlementMode: "GOLD" | "CASH_AGAINST_GOLD" | "CASH_ONLY";
  goldRateUsedPaisePerGram?: number;
  cashPaidAgainstGoldPaise?: number;
  withdrawals: KarigarWithdrawalRecord[];
  status: "DRAFT" | "CONFIRMED_LOCKED" | "REVERSED";
  confirmedAt?: string;
  confirmedBy?: string;
  ledgerEntryId?: string;
  notes?: string;
  createdAt: string;
}

interface KarigarSettlementState {
  settlements: KarigarSettlementRecord[];
  confirmSettlement: (
    settlement: Omit<KarigarSettlementRecord, "id" | "settlementNumber" | "status" | "confirmedAt" | "ledgerEntryId" | "createdAt">,
  ) => Promise<KarigarSettlementRecord>;
  getSettlementsByKarigar: (karigarId: string) => KarigarSettlementRecord[];
}

export const useKarigarAuthoritativeSettlement = create<KarigarSettlementState>()(
  persist(
    (set, get) => ({
      settlements: [
        {
          id: "kst-sample-1",
          settlementNumber: "AVS-KST-2026-0001",
          karigarId: "karigar_1",
          karigarName: "Master Karigar Bimal",
          settlementPeriod: "2026-08-01 to 2026-08-31",
          grossSalaryEarnedPaise: 4500000, // ₹45,000
          totalCashWithdrawalsPaise: 1500000, // ₹15,000
          totalGoldWithdrawalsMg: 0,
          advanceBalancePaise: 500000, // ₹5,000
          loanBalancePaise: 0,
          goldAdvanceMg: 1200, // 1.2g
          wastageDeductionMg: 400, // 0.4g
          chainDeductionMg: 0,
          netPayableCashPaise: 2500000, // ₹25,000
          netGoldToBePaidMg: 4580, // 4.58g
          settlementMode: "GOLD",
          withdrawals: [
            {
              id: "w-1",
              withdrawalCode: "WTH-001",
              date: "2026-08-10",
              type: "Cash Withdrawal",
              amountPaise: 1000000,
              weightMg: 0,
              referenceDocNo: "KT-0081",
              createdAt: "2026-08-10T11:00:00Z",
            },
            {
              id: "w-2",
              withdrawalCode: "WTH-002",
              date: "2026-08-20",
              type: "Cash Withdrawal",
              amountPaise: 500000,
              weightMg: 0,
              referenceDocNo: "KT-0092",
              createdAt: "2026-08-20T14:00:00Z",
            },
          ],
          status: "CONFIRMED_LOCKED",
          confirmedAt: "2026-09-01T10:00:00Z",
          confirmedBy: "Founder / Super Admin",
          createdAt: "2026-09-01T09:30:00Z",
        },
      ],

      confirmSettlement: async (payload) => {
        const id = `KST-${Date.now()}`;
        const settlementNumber = `AVS-KST-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;
        const confirmedAt = new Date().toISOString();
        const confirmedBy = "Showroom Founder";

        // Post settlement to authoritative ledger
        const appendLedger = useLedger.getState().append;
        let deltaWorker = 0;
        let deltaVault = 0;

        if (payload.settlementMode === "GOLD") {
          deltaVault = -payload.netGoldToBePaidMg;
          deltaWorker = -payload.netGoldToBePaidMg;
        } else if (payload.settlementMode === "CASH_AGAINST_GOLD") {
          // Cash settlement against gold obligation — records gold conversion and ledger reduction
          deltaWorker = -payload.netGoldToBePaidMg;
        }

        const ledgerRes = await appendLedger({
          type: "adjustment",
          netFineMg: deltaVault,
          deltas: {
            vault: deltaVault,
            karigar: deltaWorker,
          },
          fineMg: payload.netGoldToBePaidMg,
          notes: `[Karigar Settlement ${settlementNumber}] Mode: ${payload.settlementMode} · Net Cash: ₹${(payload.netPayableCashPaise / 100).toLocaleString("en-IN")} · Net Gold: ${(payload.netGoldToBePaidMg / 1000).toFixed(3)}g`,
          source: "karigar_settlement",
          reference: settlementNumber,
        });

        const newRecord: KarigarSettlementRecord = {
          ...payload,
          id,
          settlementNumber,
          status: "CONFIRMED_LOCKED",
          confirmedAt,
          confirmedBy,
          ledgerEntryId: ledgerRes?.id,
          createdAt: confirmedAt,
        };

        set((state) => ({
          settlements: [newRecord, ...state.settlements],
        }));

        toast.success(`Karigar settlement ${settlementNumber} confirmed & locked to ledger.`);
        return newRecord;
      },

      getSettlementsByKarigar: (karigarId: string) => {
        return get().settlements.filter((s) => s.karigarId === karigarId);
      },
    }),
    {
      name: "avs_karigar_authoritative_settlements_v1",
    },
  ),
);
