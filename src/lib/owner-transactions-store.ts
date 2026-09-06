/**
 * AVS ERP — Owner & Family Member Transactions & Ledgers
 *
 * Dedicated accounting structure for Owner and Family Member withdrawals:
 * - Creates authoritative accounts/ledgers for each family member/owner
 * - Records cash and gold withdrawals
 * - Posts atomically to the authoritative ledger
 * - Cumulative summary: Person → Transactions → Total Cash / Total Gold Withdrawn
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useLedger } from "@/lib/ledger-store";
import { gramsToMg, fineGoldMg } from "@/lib/gold";
import { toast } from "sonner";

export interface FamilyAccount {
  id: string;
  name: string;
  relation: "Owner / Partner" | "Spouse" | "Child" | "Parent" | "Family Member";
  accountCode: string; // e.g. ACC-OWNER-01
  phone?: string;
  active: boolean;
  createdAt: string;
}

export interface OwnerTransaction {
  id: string;
  transactionCode: string; // e.g. AVS-OWN-2026-0045
  familyAccountId: string;
  personName: string;
  date: string; // YYYY-MM-DD
  type: "Cash Withdrawal" | "Gold Withdrawal" | "Capital Introduction (Cash)" | "Capital Introduction (Gold)";
  cashAmountPaise: number;
  grossMg: number;
  purity: number;
  fineMg: number;
  reasonOrNarration: string;
  paymentMode?: string; // Cash, Bank, Direct Vault
  ledgerEntryId?: string;
  createdAt: string;
}

interface OwnerTransactionState {
  familyAccounts: FamilyAccount[];
  transactions: OwnerTransaction[];
  addFamilyAccount: (account: Omit<FamilyAccount, "id" | "createdAt">) => FamilyAccount;
  addTransaction: (
    txn: Omit<OwnerTransaction, "id" | "transactionCode" | "createdAt" | "ledgerEntryId">,
  ) => Promise<OwnerTransaction>;
  getPersonSummary: (familyAccountId: string) => {
    totalCashWithdrawnPaise: number;
    totalGoldWithdrawnMg: number;
    totalCapitalIntroducedCashPaise: number;
    totalCapitalIntroducedGoldMg: number;
    netCashPositionPaise: number;
    netGoldPositionMg: number;
  };
}

export const useOwnerTransactions = create<OwnerTransactionState>()(
  persist(
    (set, get) => ({
      familyAccounts: [
        {
          id: "fam-acc-1",
          name: "Rajesh Gupta (Founder / Managing Partner)",
          relation: "Owner / Partner",
          accountCode: "ACC-OWN-01",
          phone: "+91 98300 00001",
          active: true,
          createdAt: "2024-01-01T00:00:00Z",
        },
        {
          id: "fam-acc-2",
          name: "Suman Gupta (Partner / Family)",
          relation: "Spouse",
          accountCode: "ACC-OWN-02",
          phone: "+91 98300 00002",
          active: true,
          createdAt: "2024-01-01T00:00:00Z",
        },
      ],

      transactions: [
        {
          id: "own-sample-1",
          transactionCode: "AVS-OWN-2026-0001",
          familyAccountId: "fam-acc-1",
          personName: "Rajesh Gupta (Founder / Managing Partner)",
          date: "2026-09-02",
          type: "Cash Withdrawal",
          cashAmountPaise: 5000000, // ₹50,000
          grossMg: 0,
          purity: 0,
          fineMg: 0,
          reasonOrNarration: "Personal drawings for household expenses",
          paymentMode: "Cash",
          createdAt: "2026-09-02T12:00:00Z",
        },
      ],

      addFamilyAccount: (payload) => {
        const id = `fam-acc-${Date.now()}`;
        const newAcc: FamilyAccount = {
          ...payload,
          id,
          createdAt: new Date().toISOString(),
        };
        set((state) => ({ familyAccounts: [...state.familyAccounts, newAcc] }));
        toast.success(`Owner / Family Account created: ${newAcc.name}`);
        return newAcc;
      },

      addTransaction: async (txn) => {
        const id = `OWN-${Date.now()}`;
        const transactionCode = `AVS-OWN-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;
        const createdAt = new Date().toISOString();

        // Post to authoritative double-entry Ledger
        const appendLedger = useLedger.getState().append;
        let deltaVault = 0;

        if (txn.type === "Gold Withdrawal") {
          deltaVault = -txn.fineMg;
        } else if (txn.type === "Capital Introduction (Gold)") {
          deltaVault = txn.fineMg;
        }

        const ledgerRes = await appendLedger({
          type: "adjustment",
          netFineMg: deltaVault,
          deltas: {
            vault: deltaVault,
          },
          fineMg: txn.fineMg,
          notes: `[Owner Drawings: ${txn.personName}] Type: ${txn.type} · Cash: ₹${(txn.cashAmountPaise / 100).toLocaleString("en-IN")} · ${txn.reasonOrNarration}`,
          source: "owner_transaction",
          reference: transactionCode,
        });

        const newRecord: OwnerTransaction = {
          ...txn,
          id,
          transactionCode,
          ledgerEntryId: ledgerRes?.id,
          createdAt,
        };

        set((state) => ({
          transactions: [newRecord, ...state.transactions],
        }));

        toast.success(`Owner transaction ${transactionCode} posted to ledger.`);
        return newRecord;
      },

      getPersonSummary: (familyAccountId: string) => {
        const txns = get().transactions.filter((t) => t.familyAccountId === familyAccountId);
        let totalCashWithdrawnPaise = 0;
        let totalGoldWithdrawnMg = 0;
        let totalCapitalIntroducedCashPaise = 0;
        let totalCapitalIntroducedGoldMg = 0;

        for (const t of txns) {
          if (t.type === "Cash Withdrawal") totalCashWithdrawnPaise += t.cashAmountPaise;
          if (t.type === "Gold Withdrawal") totalGoldWithdrawnMg += t.fineMg;
          if (t.type === "Capital Introduction (Cash)") totalCapitalIntroducedCashPaise += t.cashAmountPaise;
          if (t.type === "Capital Introduction (Gold)") totalCapitalIntroducedGoldMg += t.fineMg;
        }

        return {
          totalCashWithdrawnPaise,
          totalGoldWithdrawnMg,
          totalCapitalIntroducedCashPaise,
          totalCapitalIntroducedGoldMg,
          netCashPositionPaise: totalCapitalIntroducedCashPaise - totalCashWithdrawnPaise,
          netGoldPositionMg: totalCapitalIntroducedGoldMg - totalGoldWithdrawnMg,
        };
      },
    }),
    {
      name: "avs_owner_family_transactions_v1",
    },
  ),
);
