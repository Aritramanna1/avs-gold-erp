/**
 * Offline Scheme Master / Account / Receipt — firm-scoped register.
 * Installment cash posts through postMoneyVoucher (universal ledger SoT).
 */
import { create } from "zustand";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { postMoneyVoucher } from "@/lib/money-voucher";

export type SchemePlan = {
  id: string;
  firm_id: string;
  code: string;
  name: string;
  duration_months: number;
  installment_paise: number;
  bonus_paise: number;
  metal_code: string;
  active: boolean;
  notes: string | null;
};

export type SchemeAccount = {
  id: string;
  firm_id: string;
  plan_id: string;
  party_id: string;
  party_name: string | null;
  account_no: string;
  start_date: string;
  status: "active" | "matured" | "closed" | "cancelled";
  notes: string | null;
};

export type SchemeReceipt = {
  id: string;
  firm_id: string;
  account_id: string;
  receipt_date: string;
  amount_paise: number;
  installment_no: number | null;
  money_voucher_source_id: string | null;
  narration: string | null;
};

type SchemeState = {
  plans: SchemePlan[];
  accounts: SchemeAccount[];
  receipts: SchemeReceipt[];
  loaded: boolean;
  hydrate: () => Promise<void>;
  upsertPlan: (input: {
    id?: string;
    code: string;
    name: string;
    durationMonths: number;
    installmentPaise: number;
    bonusPaise?: number;
    notes?: string;
  }) => Promise<SchemePlan>;
  enrollAccount: (input: {
    planId: string;
    partyId: string;
    partyName: string;
    accountNo: string;
    startDate?: string;
    notes?: string;
  }) => Promise<SchemeAccount>;
  postReceipt: (input: {
    accountId: string;
    amountPaise: number;
    receiptDate?: string;
    installmentNo?: number;
    narration?: string;
  }) => Promise<SchemeReceipt>;
};

async function resolveFirmId(): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("my_firm_id");
  if (error || !data) throw new Error(error?.message || "Firm not loaded");
  return String(data);
}

/** Parity tables may lag generated Database types. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export const useSchemeStore = create<SchemeState>((set, get) => ({
  plans: [],
  accounts: [],
  receipts: [],
  loaded: false,

  hydrate: async () => {
    let fid: string;
    try {
      fid = await resolveFirmId();
    } catch {
      return;
    }
    const [plans, accounts, receipts] = await Promise.all([
      db.from("scheme_plans").select("*").eq("firm_id", fid).order("code"),
      db.from("scheme_accounts").select("*").eq("firm_id", fid).order("account_no"),
      db
        .from("scheme_receipts")
        .select("*")
        .eq("firm_id", fid)
        .order("receipt_date", { ascending: false }),
    ]);
    set({
      plans: (plans.data ?? []) as SchemePlan[],
      accounts: (accounts.data ?? []) as SchemeAccount[],
      receipts: (receipts.data ?? []) as SchemeReceipt[],
      loaded: true,
    });
  },

  upsertPlan: async (input) => {
    const fid = await resolveFirmId();
    const row = {
      firm_id: fid,
      code: input.code.trim(),
      name: input.name.trim(),
      duration_months: input.durationMonths,
      installment_paise: input.installmentPaise,
      bonus_paise: input.bonusPaise ?? 0,
      notes: input.notes ?? null,
      updated_at: new Date().toISOString(),
    };
    const q = input.id
      ? db.from("scheme_plans").update(row).eq("id", input.id).eq("firm_id", fid).select().single()
      : db.from("scheme_plans").insert(row).select().single();
    const { data, error } = await q;
    if (error) throw error;
    await get().hydrate();
    return data as SchemePlan;
  },

  enrollAccount: async (input) => {
    const fid = await resolveFirmId();
    const { data, error } = await db
      .from("scheme_accounts")
      .insert({
        firm_id: fid,
        plan_id: input.planId,
        party_id: input.partyId,
        party_name: input.partyName,
        account_no: input.accountNo.trim(),
        start_date: input.startDate ?? new Date().toISOString().slice(0, 10),
        notes: input.notes ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    await get().hydrate();
    return data as SchemeAccount;
  },

  postReceipt: async (input) => {
    await resolveFirmId();
    const account = get().accounts.find((a) => a.id === input.accountId);
    if (!account) throw new Error("Scheme account not found");
    const sourceId = `scheme-rcpt-${crypto.randomUUID()}`;
    const money = await postMoneyVoucher({
      kind: "receipt",
      partyId: account.party_id,
      amountPaise: input.amountPaise,
      method: "cash",
      narration: input.narration || `Scheme installment ${account.account_no}`,
      source: "scheme_receipt",
      sourceId,
      voucherDate: input.receiptDate,
    });
    if (!money.posted && !money.alreadyPosted) {
      throw new Error(money.error || "Money voucher failed");
    }
    const { data, error } = await db
      .from("scheme_receipts")
      .insert({
        firm_id: account.firm_id,
        account_id: input.accountId,
        receipt_date: input.receiptDate ?? new Date().toISOString().slice(0, 10),
        amount_paise: input.amountPaise,
        installment_no: input.installmentNo ?? null,
        money_voucher_source_id: sourceId,
        narration: input.narration ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    await get().hydrate();
    return data as SchemeReceipt;
  },
}));
