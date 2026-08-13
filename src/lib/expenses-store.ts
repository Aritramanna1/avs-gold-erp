import { create } from "zustand";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { createRepository } from "./repositories/base-repository";
import { assertPeriodOpenOnline } from "./financial-lock-store";
import { useWorkflowEngine } from "./workflow-engine";

const appSettingsRepository = createRepository<{ id: string } & Record<string, unknown>>(
  "app_settings",
);

export interface ExpensePerson {
  id: string;
  fullName: string;
  role?: string;
  phone?: string;
  notes?: string;
  active: boolean;
}

export interface FamilyWithdrawal {
  id: string;
  date: string; // YYYY-MM-DD
  personId: string;
  amountPaise: number;
  paymentMode: "cash" | "upi" | "bank" | "other";
  reason?: string;
  notes?: string;
  branchId: string;
}

export interface ExpenseRecord {
  id: string;
  date: string; // YYYY-MM-DD
  type: "business" | "personal" | "investment";
  category: string;
  amountPaise: number;
  paymentMode: "cash" | "upi" | "bank" | "other";
  notes?: string;
  personId?: string; // For personal tracking if linked
  branchId: string;
}

interface ExpensesState {
  people: ExpensePerson[];
  withdrawals: FamilyWithdrawal[];
  expenses: ExpenseRecord[];

  refresh: () => Promise<void>;

  addPerson: (p: Omit<ExpensePerson, "id">) => Promise<ExpensePerson>;
  updatePerson: (id: string, patch: Partial<ExpensePerson>) => Promise<void>;
  removePerson: (id: string) => Promise<void>;

  addWithdrawal: (w: Omit<FamilyWithdrawal, "id">) => Promise<FamilyWithdrawal>;
  updateWithdrawal: (id: string, patch: Partial<FamilyWithdrawal>) => Promise<void>;
  removeWithdrawal: (id: string) => Promise<void>;

  addExpense: (e: Omit<ExpenseRecord, "id">) => Promise<ExpenseRecord>;
  updateExpense: (id: string, patch: Partial<ExpenseRecord>) => Promise<void>;
  removeExpense: (id: string) => Promise<void>;
  seedDefaults: () => Promise<void>;
}

export const useExpensesStore = create<ExpensesState>()((set, get) => {
  const saveState = async (updated: {
    people: ExpensePerson[];
    withdrawals: FamilyWithdrawal[];
    expenses: ExpenseRecord[];
  }) => {
    await appSettingsRepository.saveAs("expenses_store", updated);
    set(updated);
  };

  return {
    people: [],
    withdrawals: [],
    expenses: [],

    refresh: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("data")
        .eq("id", "expenses_store")
        .maybeSingle();

      if (error) {
        console.error("Error fetching expenses_store settings:", error);
        return;
      }
      if (data && data.data) {
        const payload = data.data as any;
        set({
          people: payload.people || [],
          withdrawals: payload.withdrawals || [],
          expenses: payload.expenses || [],
        });
      } else {
        // If no records in database yet, seed default people
        await get().seedDefaults();
      }
    },

    addPerson: async (input) => {
      const id = "xp_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
      const person = { ...input, id };
      const people = [...get().people, person];
      await saveState({ people, withdrawals: get().withdrawals, expenses: get().expenses });
      return person;
    },
    updatePerson: async (id, patch) => {
      const people = get().people.map((p) => (p.id === id ? { ...p, ...patch } : p));
      await saveState({ people, withdrawals: get().withdrawals, expenses: get().expenses });
    },
    removePerson: async (id) => {
      const people = get().people.filter((p) => p.id !== id);
      await saveState({ people, withdrawals: get().withdrawals, expenses: get().expenses });
    },

    addWithdrawal: async (input) => {
      const id = "wd_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
      const withdrawal = { ...input, id };
      const withdrawals = [withdrawal, ...get().withdrawals];
      await saveState({ people: get().people, withdrawals, expenses: get().expenses });
      return withdrawal;
    },
    updateWithdrawal: async (id, patch) => {
      const withdrawals = get().withdrawals.map((w) => (w.id === id ? { ...w, ...patch } : w));
      await saveState({ people: get().people, withdrawals, expenses: get().expenses });
    },
    removeWithdrawal: async (id) => {
      const withdrawals = get().withdrawals.filter((w) => w.id !== id);
      await saveState({ people: get().people, withdrawals, expenses: get().expenses });
    },

    addExpense: async (input) => {
      // Financial lock: block backdating an expense into a month-end-closed period.
      // Configurable via Settings → Workflow (financialLockEnforcementEnabled).
      if (useWorkflowEngine.getState().config.financialLockEnforcementEnabled) {
        await assertPeriodOpenOnline(input.branchId || "MAIN", input.date);
      }

      const id = "ex_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
      const expense = { ...input, id };
      const expenses = [expense, ...get().expenses];
      await saveState({ people: get().people, withdrawals: get().withdrawals, expenses });
      return expense;
    },
    updateExpense: async (id, patch) => {
      const expenses = get().expenses.map((e) => (e.id === id ? { ...e, ...patch } : e));
      await saveState({ people: get().people, withdrawals: get().withdrawals, expenses });
    },
    removeExpense: async (id) => {
      const expenses = get().expenses.filter((e) => e.id !== id);
      await saveState({ people: get().people, withdrawals: get().withdrawals, expenses });
    },

    seedDefaults: async () => {
      const existing = get().people;
      if (existing.length === 0) {
        const defaultPeople = [
          {
            id: "p-aritra",
            fullName: "Aritra Manna",
            role: "Owner Family",
            phone: "+91 98001 23456",
            notes: "Founder partner",
            active: true,
          },
          {
            id: "p-arkan",
            fullName: "Arkan Manna",
            role: "Owner Family",
            phone: "+91 98001 23457",
            notes: "Managing partner",
            active: true,
          },
          {
            id: "p-vishwajit",
            fullName: "Vishwajit Manna",
            role: "Owner Family",
            phone: "+91 98001 23458",
            notes: "Adviser",
            active: true,
          },
        ];
        await saveState({
          people: defaultPeople,
          withdrawals: get().withdrawals,
          expenses: get().expenses,
        });
      }
    },
  };
});
