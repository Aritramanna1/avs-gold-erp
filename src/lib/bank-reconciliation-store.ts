import { create } from "zustand";
import { dataProvider as supabase } from "@/lib/providers/data-provider";

export interface BankReconciliationSession {
  id: string;
  bankAccountCode: string;
  periodFrom: string;
  periodTo: string;
  statementBalancePaise: number;
  bookBalancePaise: number;
  clearedEntries: Array<{ voucherNumber: string; amountPaise: number; cleared: boolean }>;
  status: "open" | "reconciled" | "archived";
  notes: string | null;
  createdAt: string;
}

type Row = {
  id: string;
  bank_account_code: string;
  period_from: string;
  period_to: string;
  statement_balance_paise: number;
  book_balance_paise: number;
  cleared_entries: BankReconciliationSession["clearedEntries"];
  status: BankReconciliationSession["status"];
  notes: string | null;
  created_at: string;
};

function fromRow(row: Row): BankReconciliationSession {
  return {
    id: row.id,
    bankAccountCode: row.bank_account_code,
    periodFrom: row.period_from,
    periodTo: row.period_to,
    statementBalancePaise: row.statement_balance_paise,
    bookBalancePaise: row.book_balance_paise,
    clearedEntries: Array.isArray(row.cleared_entries) ? row.cleared_entries : [],
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

interface BankReconState {
  sessions: BankReconciliationSession[];
  loading: boolean;
  hydrate: () => Promise<void>;
  createSession: (
    input: Omit<BankReconciliationSession, "id" | "createdAt" | "status">,
  ) => Promise<void>;
  reconcile: (id: string, notes?: string) => Promise<void>;
}

export const useBankReconciliation = create<BankReconState>()((set, get) => ({
  sessions: [],
  loading: false,

  hydrate: async () => {
    set({ loading: true });
    try {
      const { data, error } = await supabase
        .from("bank_reconciliation_sessions" as never)
        .select(
          "id,bank_account_code,period_from,period_to,statement_balance_paise,book_balance_paise,cleared_entries,status,notes,created_at",
        )
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      set({ sessions: ((data ?? []) as unknown as Row[]).map(fromRow) });
    } finally {
      set({ loading: false });
    }
  },

  createSession: async (input) => {
    const { error } = await supabase.from("bank_reconciliation_sessions" as never).insert({
      bank_account_code: input.bankAccountCode,
      period_from: input.periodFrom,
      period_to: input.periodTo,
      statement_balance_paise: input.statementBalancePaise,
      book_balance_paise: input.bookBalancePaise,
      cleared_entries: input.clearedEntries,
      notes: input.notes,
      status: "open",
      updated_at: new Date().toISOString(),
    } as never);
    if (error) throw error;
    await get().hydrate();
  },

  reconcile: async (id, notes) => {
    const { error } = await supabase
      .from("bank_reconciliation_sessions" as never)
      .update({
        status: "reconciled",
        notes: notes ?? null,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", id);
    if (error) throw error;
    await get().hydrate();
  },
}));
