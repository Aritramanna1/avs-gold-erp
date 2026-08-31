import { create } from "zustand";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { createRepository } from "./repositories/base-repository";
import { assertPeriodOpenOnline } from "./financial-lock-store";
import { useWorkflowEngine } from "./workflow-engine";
import { useSettings } from "./settings-store";
import { getCurrentGoldRatePaise } from "./bullion-rate-service";

const appSettingsRepository = createRepository<{ id: string } & Record<string, unknown>>(
  "app_settings",
);

export type FamilyRelationship =
  | "owner"
  | "spouse"
  | "parent"
  | "child"
  | "home"
  | "partner"
  | "other";

export const RELATIONSHIP_LABELS: Record<FamilyRelationship, string> = {
  owner: "Owner / Proprietor",
  spouse: "Spouse",
  parent: "Parent",
  child: "Child / Dependent",
  home: "Home / Family Common",
  partner: "Partner / Director",
  other: "Other Family Member",
};

export interface ExpensePerson {
  id: string;
  fullName: string;
  relationship: FamilyRelationship;
  role?: string;
  phone?: string;
  notes?: string;
  compensationMode?: "drawing" | "salary";
  active: boolean;
}

export interface FamilyWithdrawal {
  id: string;
  date: string; // YYYY-MM-DD
  personId: string;
  personName?: string;
  relationship?: FamilyRelationship;
  amountPaise: number;
  goldEquivalentMg?: number;
  goldRatePerGramPaise?: number;
  paymentMode: "cash" | "upi" | "bank" | "other";
  reason?: string;
  purpose?: string;
  notes?: string;
  branchId: string;
  createdAt?: number;
  createdBy?: string;
}

export interface ExpenseRecord {
  id: string;
  date: string; // YYYY-MM-DD
  type: "business" | "personal" | "investment";
  category: string;
  amountPaise: number;
  paymentMode: "cash" | "upi" | "bank" | "other";
  businessPurpose?: string;
  notes?: string;
  vendorName?: string;
  reference?: string;
  personId?: string; // For personal tracking if linked
  branchId: string;
  status?: "approved" | "pending" | "rejected";
  createdAt?: number;
  createdBy?: string;
}

export interface BusinessProfitSummary {
  periodFrom: string;
  periodTo: string;
  // Revenue
  grossRevenuePaise: number;
  makingChargesPaise: number;
  fineMarginPaise: number;
  otherIncomePaise: number;
  // Direct Costs
  directWorkCostPaise: number;
  karigarLabourCostPaise: number;
  carrierCostPaise: number;
  // Margins
  grossProfitPaise: number;
  grossProfitMarginPct: number;
  // Operating Expenses
  businessExpensesPaise: number;
  // Net Profit / Loss
  netBusinessProfitPaise: number;
  netProfitMarginPct: number;
  isLoss: boolean;
  // Owner Equity / Drawings
  ownerDrawingsPaise: number;
  netEquityImpactPaise: number;
  // Gold equivalents
  grossRevenueFineMg: number;
  businessExpensesFineMg: number;
  netBusinessProfitFineMg: number;
  ownerDrawingsFineMg: number;
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

const EXPENSES_CACHE_KEY = "avs_expenses_store_cache";

function loadCachedExpenses(): {
  people?: ExpensePerson[];
  withdrawals?: FamilyWithdrawal[];
  expenses?: ExpenseRecord[];
} | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(EXPENSES_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export const useExpensesStore = create<ExpensesState>()((set, get) => {
  const cached = loadCachedExpenses();

  const saveState = async (updated: {
    people: ExpensePerson[];
    withdrawals: FamilyWithdrawal[];
    expenses: ExpenseRecord[];
  }) => {
    set(updated);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(EXPENSES_CACHE_KEY, JSON.stringify(updated));
      } catch {
        // Ignore local storage quota limits
      }
    }
    try {
      await supabase
        .from("app_settings")
        .upsert({ id: "expenses_store", data: updated } as any);
    } catch (e) {
      // In offline/mock test environments, state is preserved in-memory and local cache
    }
  };

  return {
    people: cached?.people || [],
    withdrawals: cached?.withdrawals || [],
    expenses: cached?.expenses || [],

    refresh: async () => {
      try {
        const { data, error } = await supabase
          .from("app_settings")
          .select("data")
          .eq("id", "expenses_store")
          .maybeSingle();

        if (error) {
          return;
        }
        if (data && data.data) {
          const payload = data.data as any;
          const remoteState = {
            people: payload.people || [],
            withdrawals: payload.withdrawals || [],
            expenses: payload.expenses || [],
          };
          set(remoteState);
          if (typeof window !== "undefined") {
            try {
              localStorage.setItem(EXPENSES_CACHE_KEY, JSON.stringify(remoteState));
            } catch {
              // Ignore
            }
          }
        } else if (get().people.length === 0 && get().expenses.length === 0) {
          await get().seedDefaults();
        }
      } catch {
        // Network offline fallback
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
      const person = get().people.find((p) => p.id === input.personId);
      const rate =
        input.goldRatePerGramPaise ||
        getCurrentGoldRatePaise() ||
        750000;
      const goldEquiv =
        input.goldEquivalentMg ||
        (rate > 0 ? Math.round((input.amountPaise / rate) * 1000) : 0);

      const withdrawal: FamilyWithdrawal = {
        ...input,
        id,
        personName: person?.fullName || input.personName || "Family Member",
        relationship: person?.relationship || input.relationship || "home",
        goldRatePerGramPaise: rate,
        goldEquivalentMg: goldEquiv,
        createdAt: input.createdAt || Date.now(),
      };
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
      if (useWorkflowEngine.getState().config.financialLockEnforcementEnabled) {
        await assertPeriodOpenOnline(input.branchId || "MAIN", input.date);
      }

      const id = "ex_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
      const expense: ExpenseRecord = {
        ...input,
        id,
        status: input.status || "approved",
        createdAt: input.createdAt || Date.now(),
      };
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
        const defaultPeople: ExpensePerson[] = [
          {
            id: "p-aritra",
            fullName: "Aritra Manna",
            relationship: "owner",
            role: "Owner / Proprietor",
            phone: "+91 98001 23456",
            notes: "Founder & Owner",
            compensationMode: "drawing",
            active: true,
          },
          {
            id: "p-home",
            fullName: "Home & Family Expenses",
            relationship: "home",
            role: "Family Pool",
            phone: "+91 98001 23457",
            notes: "Household & domestic withdrawals",
            compensationMode: "drawing",
            active: true,
          },
          {
            id: "p-partner",
            fullName: "Vishwajit Manna",
            relationship: "partner",
            role: "Partner",
            phone: "+91 98001 23458",
            notes: "Partner equity account",
            compensationMode: "drawing",
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
