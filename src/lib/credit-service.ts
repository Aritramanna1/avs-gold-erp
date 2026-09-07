/**
 * ORNEXA — Universal Credit System Client Service
 * Manages tenant credit wallet, usage ledger, and service deduction.
 */

import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { create } from "zustand";

export interface CreditLedgerEntry {
  id: string;
  entry_type:
    "plan_grant" | "purchase" | "promo" | "deduction_ai" | "deduction_wa" | "adjustment" | "refund";
  service_type: string;
  units: number;
  amount_credits: number;
  balance_after_credits: number;
  description: string;
  created_at: string;
}

export interface TenantWalletData {
  firm_id: string;
  balance_credits: number;
  plan_credits_monthly: number;
  purchased_credits: number;
  promo_credits: number;
  low_balance_threshold: number;
  is_low_balance: boolean;
  usage: {
    total_deducted: number;
    ai_deducted: number;
    wa_deducted: number;
    recent_entries: CreditLedgerEntry[];
  };
  updated_at: string;
}

interface CreditState {
  wallet: TenantWalletData | null;
  loading: boolean;
  error: string | null;
  fetchWallet: (firmId?: string) => Promise<TenantWalletData | null>;
  deductCredits: (
    serviceCode: string,
    units?: number,
    referenceId?: string,
    description?: string,
    metadata?: Record<string, any>,
  ) => Promise<{ success: boolean; newBalance?: number; error?: string }>;
  grantCredits: (
    amount: number,
    entryType?: string,
    description?: string,
    metadata?: Record<string, any>,
  ) => Promise<{ success: boolean; newBalance?: number; error?: string }>;
}

export const useCreditStore = create<CreditState>((set, get) => ({
  wallet: null,
  loading: false,
  error: null,

  fetchWallet: async (firmId?: string) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await (supabase as any).rpc("get_tenant_credit_wallet", {
        p_firm_id: firmId || null,
      });
      if (!error && data) {
        const wallet = data as TenantWalletData;
        set({ wallet, loading: false });
        return wallet;
      }
    } catch {
      // Fall through to resilient direct query
    }

    // Direct table query fallback
    try {
      const { data: wData } = await (supabase as any)
        .from("tenant_credit_wallets")
        .select("*")
        .limit(1)
        .maybeSingle();

      const { data: lData } = await (supabase as any)
        .from("credit_ledger")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);

      const balance = Number(wData?.balance_credits ?? 1000);
      const lowThreshold = Number(wData?.low_balance_threshold ?? 100);
      const recentEntries = (lData ?? []).map((l: any) => ({
        id: l.id,
        entry_type: l.entry_type,
        service_type: l.service_type,
        units: Number(l.units ?? 1),
        amount_credits: Number(l.amount_credits ?? 0),
        balance_after_credits: Number(l.balance_after_credits ?? balance),
        description: l.description || "",
        created_at: l.created_at || new Date().toISOString(),
      }));

      const aiDeducted = recentEntries
        .filter((e: any) => e.entry_type === "deduction_ai" || e.service_type?.startsWith("ai"))
        .reduce((sum: number, e: any) => sum + Math.abs(e.amount_credits), 0);

      const waDeducted = recentEntries
        .filter((e: any) => e.entry_type === "deduction_wa" || e.service_type?.startsWith("wa"))
        .reduce((sum: number, e: any) => sum + Math.abs(e.amount_credits), 0);

      const totalDeducted = recentEntries
        .filter((e: any) => e.amount_credits < 0)
        .reduce((sum: number, e: any) => sum + Math.abs(e.amount_credits), 0);

      const fallbackWallet: TenantWalletData = {
        firm_id: wData?.firm_id || firmId || "00000000-0000-0000-0000-000000000000",
        balance_credits: balance,
        plan_credits_monthly: Number(wData?.plan_credits_monthly ?? 500),
        purchased_credits: Number(wData?.purchased_credits ?? 0),
        promo_credits: Number(wData?.promo_credits ?? 500),
        low_balance_threshold: lowThreshold,
        is_low_balance: balance <= lowThreshold,
        usage: {
          total_deducted: totalDeducted,
          ai_deducted: aiDeducted,
          wa_deducted: waDeducted,
          recent_entries: recentEntries,
        },
        updated_at: wData?.updated_at || new Date().toISOString(),
      };

      set({ wallet: fallbackWallet, loading: false });
      return fallbackWallet;
    } catch {
      const defaultWallet: TenantWalletData = {
        firm_id: firmId || "00000000-0000-0000-0000-000000000000",
        balance_credits: 1000,
        plan_credits_monthly: 500,
        purchased_credits: 0,
        promo_credits: 500,
        low_balance_threshold: 100,
        is_low_balance: false,
        usage: {
          total_deducted: 0,
          ai_deducted: 0,
          wa_deducted: 0,
          recent_entries: [],
        },
        updated_at: new Date().toISOString(),
      };
      set({ wallet: defaultWallet, loading: false });
      return defaultWallet;
    }
  },

  deductCredits: async (serviceCode, units = 1, referenceId, description, metadata = {}) => {
    try {
      const { data, error } = await (supabase as any).rpc("deduct_tenant_credits", {
        p_service_code: serviceCode,
        p_units: units,
        p_reference_id: referenceId || null,
        p_description: description || null,
        p_metadata: metadata,
      });
      if (error) throw error;

      if (data?.success) {
        // Optimistically update wallet balance in store
        const current = get().wallet;
        if (current) {
          set({
            wallet: {
              ...current,
              balance_credits: data.new_balance,
              is_low_balance: data.new_balance <= current.low_balance_threshold,
            },
          });
        }
        return { success: true, newBalance: data.new_balance };
      } else {
        return { success: false, error: data?.error || "Insufficient credits" };
      }
    } catch (err: any) {
      console.error("[CreditStore] Credit deduction error:", err);
      return { success: false, error: err.message || "Credit deduction failed" };
    }
  },

  grantCredits: async (amount, entryType = "purchase", description, metadata = {}) => {
    try {
      const { data, error } = await (supabase as any).rpc("grant_tenant_credits", {
        p_credit_amount: amount,
        p_entry_type: entryType,
        p_description: description || null,
        p_metadata: metadata,
      });
      if (error) throw error;

      if (data?.success) {
        // Refresh full wallet after top-up
        await get().fetchWallet();
        return { success: true, newBalance: data.new_balance };
      }
      return { success: false, error: "Credit grant failed" };
    } catch (err: any) {
      console.error("[CreditStore] Credit grant error:", err);
      return { success: false, error: err.message || "Credit top-up failed" };
    }
  },
}));
