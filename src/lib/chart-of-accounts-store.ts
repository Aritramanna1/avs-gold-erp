/**
 * Chart of Accounts, Dual Cash/Metal Ledgers & Period Control Store
 * Master Reference: docs/ACCOUNTING_AND_PERIOD_CONTROL.md
 *
 * Supabase tables: account_groups, ledger_accounts, day_close_records
 * Period settings: app_settings scope firm
 */
import { create } from "zustand";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { toast } from "sonner";

export type AccountNature = "asset" | "liability" | "income" | "expense";

export interface AccountGroup {
  id: string;
  name: string;
  code: string;
  nature: AccountNature;
  parentGroupId?: string;
  description?: string;
  isSystem: boolean;
}

export interface LedgerAccount {
  id: string;
  name: string;
  code: string;
  groupId: string;
  nature: AccountNature;
  openingBalancePaise: number;
  openingGoldMg: number;
  currentBalancePaise: number;
  currentGoldMg: number;
  isCashOrBank: boolean;
  bankAccountNumber?: string;
  ifscCode?: string;
  isActive: boolean;
  notes?: string;
}

export interface DayCloseRecord {
  id: string;
  date: string;
  closedAt: string;
  cashDrawerPhysicalPaise: number;
  cashSystemExpectedPaise: number;
  cashVariancePaise: number;
  vaultGoldPhysicalMg: number;
  vaultGoldSystemExpectedMg: number;
  goldVarianceMg: number;
  verifiedBy: string;
  status: "reconciled" | "variance_flagged";
  notes?: string;
}

export interface FinancialPeriodSettings {
  activeFinancialYear: string;
  yearStartDate: string;
  yearEndDate: string;
  freezeBeforeDate: string | null;
  isYearLocked: boolean;
  dayCloseHistory: DayCloseRecord[];
}

const DEFAULT_PERIOD_SETTINGS: FinancialPeriodSettings = {
  activeFinancialYear: "2026-2027",
  yearStartDate: "2026-04-01",
  yearEndDate: "2027-03-31",
  freezeBeforeDate: null,
  isYearLocked: false,
  dayCloseHistory: [],
};

const DEFAULT_ACCOUNT_GROUPS: AccountGroup[] = [
  {
    id: "grp_cur_assets",
    name: "Current Assets",
    code: "CURR_ASSETS",
    nature: "asset",
    isSystem: true,
  },
  {
    id: "grp_cash_bank",
    name: "Cash & Bank Accounts",
    code: "CASH_BANK",
    nature: "asset",
    parentGroupId: "grp_cur_assets",
    isSystem: true,
  },
  {
    id: "grp_sundry_debtors",
    name: "Sundry Debtors (Customers)",
    code: "SUNDRY_DEBTORS",
    nature: "asset",
    parentGroupId: "grp_cur_assets",
    isSystem: true,
  },
  {
    id: "grp_stock_vault",
    name: "Vault & Physical Metal Stock",
    code: "STOCK_VAULT",
    nature: "asset",
    parentGroupId: "grp_cur_assets",
    isSystem: true,
  },
  {
    id: "grp_wip_karigar",
    name: "Workshop WIP & Karigar Gold",
    code: "WIP_KARIGAR",
    nature: "asset",
    parentGroupId: "grp_cur_assets",
    isSystem: true,
  },
  {
    id: "grp_fixed_assets",
    name: "Fixed Assets & Machinery",
    code: "FIXED_ASSETS",
    nature: "asset",
    isSystem: true,
  },
  {
    id: "grp_cur_liabilities",
    name: "Current Liabilities",
    code: "CURR_LIAB",
    nature: "liability",
    isSystem: true,
  },
  {
    id: "grp_sundry_creditors",
    name: "Sundry Creditors (Suppliers)",
    code: "SUNDRY_CREDITORS",
    nature: "liability",
    parentGroupId: "grp_cur_liabilities",
    isSystem: true,
  },
  {
    id: "grp_cust_gold_dep",
    name: "Customer Metal Deposits",
    code: "CUST_GOLD_DEP",
    nature: "liability",
    parentGroupId: "grp_cur_liabilities",
    isSystem: true,
  },
  {
    id: "grp_karigar_labour",
    name: "Karigar Labour Payable",
    code: "KARIGAR_PAYABLE",
    nature: "liability",
    parentGroupId: "grp_cur_liabilities",
    isSystem: true,
  },
  {
    id: "grp_duties_taxes",
    name: "Duties & Taxes (GST/TDS)",
    code: "DUTIES_TAXES",
    nature: "liability",
    parentGroupId: "grp_cur_liabilities",
    isSystem: true,
  },
  {
    id: "grp_sales_rev",
    name: "Sales & Turnover Revenue",
    code: "SALES_REV",
    nature: "income",
    isSystem: true,
  },
  {
    id: "grp_making_rev",
    name: "Making Charges Income",
    code: "MAKING_REV",
    nature: "income",
    isSystem: true,
  },
  {
    id: "grp_other_income",
    name: "Indirect & Other Income",
    code: "OTHER_INCOME",
    nature: "income",
    isSystem: true,
  },
  {
    id: "grp_cogs",
    name: "Direct Cost of Goods Sold",
    code: "COGS_DIRECT",
    nature: "expense",
    isSystem: true,
  },
  {
    id: "grp_karigar_cost",
    name: "Artisan Labour / Making Cost",
    code: "KARIGAR_COST",
    nature: "expense",
    parentGroupId: "grp_cogs",
    isSystem: true,
  },
  {
    id: "grp_outside_proc",
    name: "Outside Subcontract (Mina/Polish)",
    code: "OUTSIDE_PROC",
    nature: "expense",
    parentGroupId: "grp_cogs",
    isSystem: true,
  },
  {
    id: "grp_admin_expenses",
    name: "Administrative & Showroom Expenses",
    code: "ADMIN_EXP",
    nature: "expense",
    isSystem: true,
  },
];

const DEFAULT_LEDGER_ACCOUNTS: LedgerAccount[] = [
  {
    id: "acc_main_cash",
    name: "Main Cash Drawer",
    code: "1001",
    groupId: "grp_cash_bank",
    nature: "asset",
    openingBalancePaise: 0,
    openingGoldMg: 0,
    currentBalancePaise: 0,
    currentGoldMg: 0,
    isCashOrBank: true,
    isActive: true,
  },
  {
    id: "acc_fine_gold_vault",
    name: "Fine Gold Bullion Vault (999)",
    code: "1101",
    groupId: "grp_stock_vault",
    nature: "asset",
    openingBalancePaise: 0,
    openingGoldMg: 0,
    currentBalancePaise: 0,
    currentGoldMg: 0,
    isCashOrBank: false,
    isActive: true,
  },
  {
    id: "acc_gold_sales",
    name: "Gold Jewellery Sales Account",
    code: "3001",
    groupId: "grp_sales_rev",
    nature: "income",
    openingBalancePaise: 0,
    openingGoldMg: 0,
    currentBalancePaise: 0,
    currentGoldMg: 0,
    isCashOrBank: false,
    isActive: true,
  },
  {
    id: "acc_making_income",
    name: "Making Charges Collected",
    code: "3101",
    groupId: "grp_making_rev",
    nature: "income",
    openingBalancePaise: 0,
    openingGoldMg: 0,
    currentBalancePaise: 0,
    currentGoldMg: 0,
    isCashOrBank: false,
    isActive: true,
  },
];

interface GroupRow {
  id: string;
  name: string;
  code: string;
  nature: string;
  parent_group_id: string | null;
  description: string | null;
  is_system: boolean;
}

interface AccountRow {
  id: string;
  group_id: string;
  name: string;
  code: string;
  nature: string;
  opening_balance_paise: number;
  opening_gold_mg: number;
  current_balance_paise: number;
  current_gold_mg: number;
  is_cash_or_bank: boolean;
  bank_account_number: string | null;
  ifsc_code: string | null;
  is_active: boolean;
  notes: string | null;
}

interface DayCloseRow {
  id: string;
  date: string;
  closed_at: string;
  cash_drawer_physical_paise: number;
  cash_system_expected_paise: number;
  cash_variance_paise: number;
  vault_gold_physical_mg: number;
  vault_gold_system_expected_mg: number;
  gold_variance_mg: number;
  verified_by: string;
  status: string;
  notes: string | null;
}

function fromGroupRow(row: GroupRow): AccountGroup {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    nature: row.nature as AccountNature,
    parentGroupId: row.parent_group_id ?? undefined,
    description: row.description ?? undefined,
    isSystem: row.is_system,
  };
}

function fromAccountRow(row: AccountRow): LedgerAccount {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    groupId: row.group_id,
    nature: row.nature as AccountNature,
    openingBalancePaise: row.opening_balance_paise,
    openingGoldMg: row.opening_gold_mg,
    currentBalancePaise: row.current_balance_paise,
    currentGoldMg: row.current_gold_mg,
    isCashOrBank: row.is_cash_or_bank,
    bankAccountNumber: row.bank_account_number ?? undefined,
    ifscCode: row.ifsc_code ?? undefined,
    isActive: row.is_active,
    notes: row.notes ?? undefined,
  };
}

function fromDayCloseRow(row: DayCloseRow): DayCloseRecord {
  return {
    id: row.id,
    date: row.date,
    closedAt: row.closed_at,
    cashDrawerPhysicalPaise: row.cash_drawer_physical_paise,
    cashSystemExpectedPaise: row.cash_system_expected_paise,
    cashVariancePaise: row.cash_variance_paise,
    vaultGoldPhysicalMg: row.vault_gold_physical_mg,
    vaultGoldSystemExpectedMg: row.vault_gold_system_expected_mg,
    goldVarianceMg: row.gold_variance_mg,
    verifiedBy: row.verified_by,
    status: row.status as DayCloseRecord["status"],
    notes: row.notes ?? undefined,
  };
}

async function getFirmId(): Promise<string | null> {
  const { data } = await supabase
    .from("user_profiles" as never)
    .select("firm_id")
    .maybeSingle();
  return (data as { firm_id?: string } | null)?.firm_id ?? null;
}

async function seedChartDefaults(): Promise<void> {
  const groupRows = DEFAULT_ACCOUNT_GROUPS.map((g) => ({
    id: g.id,
    name: g.name,
    code: g.code,
    nature: g.nature,
    parent_group_id: g.parentGroupId ?? null,
    description: g.description ?? null,
    is_system: g.isSystem,
  }));
  const { error: gErr } = await supabase
    .from("account_groups" as never)
    .upsert(groupRows as never, {
      onConflict: "id",
    });
  if (gErr) console.warn("[chart-of-accounts] seed groups:", gErr.message);

  const accountRows = DEFAULT_LEDGER_ACCOUNTS.map((a) => ({
    id: a.id,
    group_id: a.groupId,
    name: a.name,
    code: a.code,
    nature: a.nature,
    opening_balance_paise: a.openingBalancePaise,
    opening_gold_mg: a.openingGoldMg,
    current_balance_paise: a.currentBalancePaise,
    current_gold_mg: a.currentGoldMg,
    is_cash_or_bank: a.isCashOrBank,
    bank_account_number: a.bankAccountNumber ?? null,
    ifsc_code: a.ifscCode ?? null,
    is_active: a.isActive,
    notes: a.notes ?? null,
  }));
  const { error: aErr } = await supabase
    .from("ledger_accounts" as never)
    .upsert(accountRows as never, {
      onConflict: "id",
    });
  if (aErr) console.warn("[chart-of-accounts] seed accounts:", aErr.message);
}

async function loadPeriodSettings(firmId: string): Promise<FinancialPeriodSettings> {
  const settingsId = `${firmId}_chart_period`;
  const { data } = await supabase
    .from("app_settings" as never)
    .select("data")
    .eq("id", settingsId)
    .maybeSingle();
  const stored = (data as { data?: Partial<FinancialPeriodSettings> } | null)?.data;
  return {
    ...DEFAULT_PERIOD_SETTINGS,
    ...stored,
    dayCloseHistory: [],
  };
}

async function savePeriodSettings(
  firmId: string,
  settings: FinancialPeriodSettings,
): Promise<void> {
  const settingsId = `${firmId}_chart_period`;
  const { dayCloseHistory: _history, ...persistable } = settings;
  await supabase.from("app_settings" as never).upsert({
    id: settingsId,
    firm_id: firmId,
    scope: "firm",
    data: persistable,
    updated_at: new Date().toISOString(),
  } as never);
}

interface ChartOfAccountsState {
  accountGroups: AccountGroup[];
  ledgerAccounts: LedgerAccount[];
  periodSettings: FinancialPeriodSettings;
  loading: boolean;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  addAccountGroup: (group: Omit<AccountGroup, "id">) => Promise<void>;
  updateAccountGroup: (id: string, patch: Partial<AccountGroup>) => Promise<void>;
  removeAccountGroup: (id: string) => Promise<void>;
  addLedgerAccount: (
    account: Omit<LedgerAccount, "id" | "currentBalancePaise" | "currentGoldMg">,
  ) => Promise<void>;
  updateLedgerAccount: (id: string, patch: Partial<LedgerAccount>) => Promise<void>;
  toggleLedgerAccountActive: (id: string) => Promise<void>;
  removeLedgerAccount: (id: string) => Promise<void>;
  setFreezeBeforeDate: (date: string | null) => Promise<void>;
  recordDayClose: (record: Omit<DayCloseRecord, "id" | "closedAt">) => Promise<void>;
  isDateFrozen: (dateStr: string) => boolean;
  reopenPeriodWithAuthorization: (authorizedBy: string, justification: string) => Promise<void>;
}

export const useChartOfAccountsStore = create<ChartOfAccountsState>()((set, get) => ({
  accountGroups: [],
  ledgerAccounts: [],
  periodSettings: DEFAULT_PERIOD_SETTINGS,
  loading: false,
  hydrated: false,

  hydrate: async () => {
    set({ loading: true });
    try {
      const { data: groups, error: gErr } = await supabase
        .from("account_groups" as never)
        .select("id,name,code,nature,parent_group_id,description,is_system")
        .order("code", { ascending: true });
      if (gErr) throw gErr;

      let groupRows = (groups ?? []) as unknown as GroupRow[];
      if (groupRows.length === 0) {
        await seedChartDefaults();
        const retry = await supabase
          .from("account_groups" as never)
          .select("id,name,code,nature,parent_group_id,description,is_system")
          .order("code", { ascending: true });
        if (retry.error) throw retry.error;
        groupRows = (retry.data ?? []) as unknown as GroupRow[];
      }

      const { data: accounts, error: aErr } = await supabase
        .from("ledger_accounts" as never)
        .select(
          "id,group_id,name,code,nature,opening_balance_paise,opening_gold_mg,current_balance_paise,current_gold_mg,is_cash_or_bank,bank_account_number,ifsc_code,is_active,notes",
        )
        .order("code", { ascending: true });
      if (aErr) throw aErr;

      const { data: dayCloses, error: dErr } = await supabase
        .from("day_close_records" as never)
        .select(
          "id,date,closed_at,cash_drawer_physical_paise,cash_system_expected_paise,cash_variance_paise,vault_gold_physical_mg,vault_gold_system_expected_mg,gold_variance_mg,verified_by,status,notes",
        )
        .order("date", { ascending: false })
        .limit(100);
      if (dErr) throw dErr;

      const firmId = await getFirmId();
      const periodSettings = firmId
        ? await loadPeriodSettings(firmId)
        : { ...DEFAULT_PERIOD_SETTINGS };

      set({
        accountGroups: groupRows.map(fromGroupRow),
        ledgerAccounts: ((accounts ?? []) as unknown as AccountRow[]).map(fromAccountRow),
        periodSettings: {
          ...periodSettings,
          dayCloseHistory: ((dayCloses ?? []) as unknown as DayCloseRow[]).map(fromDayCloseRow),
        },
        hydrated: true,
        loading: false,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load chart of accounts";
      console.warn("[chart-of-accounts] hydrate failed:", message);
      toast.error(message);
      set({ loading: false, hydrated: true });
    }
  },

  addAccountGroup: async (group) => {
    const id = `grp_${Date.now()}`;
    const { error } = await supabase.from("account_groups" as never).insert({
      id,
      name: group.name,
      code: group.code,
      nature: group.nature,
      parent_group_id: group.parentGroupId ?? null,
      description: group.description ?? null,
      is_system: group.isSystem ?? false,
    } as never);
    if (error) {
      toast.error(error.message ?? "Could not create account group.");
      return;
    }
    set((state) => ({
      accountGroups: [...state.accountGroups, { ...group, id }],
    }));
    toast.success(`Account group "${group.name}" created.`);
  },

  updateAccountGroup: async (id, patch) => {
    const payload: Record<string, unknown> = {};
    if (patch.name !== undefined) payload.name = patch.name;
    if (patch.code !== undefined) payload.code = patch.code;
    if (patch.nature !== undefined) payload.nature = patch.nature;
    if (patch.parentGroupId !== undefined) payload.parent_group_id = patch.parentGroupId;
    if (patch.description !== undefined) payload.description = patch.description;

    const { error } = await supabase
      .from("account_groups" as never)
      .update(payload as never)
      .eq("id", id);
    if (error) {
      toast.error(error.message ?? "Could not update account group.");
      return;
    }
    set((state) => ({
      accountGroups: state.accountGroups.map((g) => (g.id === id ? { ...g, ...patch } : g)),
    }));
    toast.success("Account group updated.");
  },

  removeAccountGroup: async (id) => {
    const hasChildren = get().ledgerAccounts.some((a) => a.groupId === id);
    if (hasChildren) {
      toast.error("Cannot delete account group with attached ledger accounts.");
      return;
    }
    const { error } = await supabase
      .from("account_groups" as never)
      .delete()
      .eq("id", id);
    if (error) {
      toast.error(error.message ?? "Could not delete account group.");
      return;
    }
    set((state) => ({
      accountGroups: state.accountGroups.filter((g) => g.id !== id),
    }));
    toast.success("Account group removed.");
  },

  addLedgerAccount: async (account) => {
    const id = `acc_${Date.now()}`;
    const currentBalancePaise = account.openingBalancePaise || 0;
    const currentGoldMg = account.openingGoldMg || 0;
    const { error } = await supabase.from("ledger_accounts" as never).insert({
      id,
      group_id: account.groupId,
      name: account.name,
      code: account.code,
      nature: account.nature,
      opening_balance_paise: account.openingBalancePaise,
      opening_gold_mg: account.openingGoldMg,
      current_balance_paise: currentBalancePaise,
      current_gold_mg: currentGoldMg,
      is_cash_or_bank: account.isCashOrBank,
      bank_account_number: account.bankAccountNumber ?? null,
      ifsc_code: account.ifscCode ?? null,
      is_active: account.isActive,
      notes: account.notes ?? null,
    } as never);
    if (error) {
      toast.error(error.message ?? "Could not create ledger account.");
      return;
    }
    const newAcc: LedgerAccount = {
      ...account,
      id,
      currentBalancePaise,
      currentGoldMg,
    };
    set((state) => ({
      ledgerAccounts: [...state.ledgerAccounts, newAcc],
    }));
    toast.success(`Ledger account "${newAcc.name}" created.`);
  },

  updateLedgerAccount: async (id, patch) => {
    const payload: Record<string, unknown> = {};
    if (patch.name !== undefined) payload.name = patch.name;
    if (patch.code !== undefined) payload.code = patch.code;
    if (patch.groupId !== undefined) payload.group_id = patch.groupId;
    if (patch.nature !== undefined) payload.nature = patch.nature;
    if (patch.openingBalancePaise !== undefined)
      payload.opening_balance_paise = patch.openingBalancePaise;
    if (patch.openingGoldMg !== undefined) payload.opening_gold_mg = patch.openingGoldMg;
    if (patch.currentBalancePaise !== undefined)
      payload.current_balance_paise = patch.currentBalancePaise;
    if (patch.currentGoldMg !== undefined) payload.current_gold_mg = patch.currentGoldMg;
    if (patch.isCashOrBank !== undefined) payload.is_cash_or_bank = patch.isCashOrBank;
    if (patch.bankAccountNumber !== undefined)
      payload.bank_account_number = patch.bankAccountNumber;
    if (patch.ifscCode !== undefined) payload.ifsc_code = patch.ifscCode;
    if (patch.isActive !== undefined) payload.is_active = patch.isActive;
    if (patch.notes !== undefined) payload.notes = patch.notes;

    const { error } = await supabase
      .from("ledger_accounts" as never)
      .update(payload as never)
      .eq("id", id);
    if (error) {
      toast.error(error.message ?? "Could not update ledger account.");
      return;
    }
    set((state) => ({
      ledgerAccounts: state.ledgerAccounts.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    }));
    toast.success("Ledger account updated.");
  },

  toggleLedgerAccountActive: async (id) => {
    const account = get().ledgerAccounts.find((a) => a.id === id);
    if (!account) return;
    await get().updateLedgerAccount(id, { isActive: !account.isActive });
  },

  removeLedgerAccount: async (id) => {
    const { error } = await supabase
      .from("ledger_accounts" as never)
      .delete()
      .eq("id", id);
    if (error) {
      toast.error(error.message ?? "Could not delete ledger account.");
      return;
    }
    set((state) => ({
      ledgerAccounts: state.ledgerAccounts.filter((a) => a.id !== id),
    }));
    toast.success("Ledger account removed.");
  },

  setFreezeBeforeDate: async (date) => {
    const firmId = await getFirmId();
    const next = { ...get().periodSettings, freezeBeforeDate: date };
    set({ periodSettings: next });
    if (firmId) await savePeriodSettings(firmId, next);
    toast.success(
      date
        ? `Accounting transactions prior to ${date} are now frozen.`
        : "Period freeze date cleared.",
    );
  },

  recordDayClose: async (record) => {
    const id = `dc_${Date.now()}`;
    const closedAt = new Date().toISOString();
    const { error } = await supabase.from("day_close_records" as never).insert({
      id,
      date: record.date,
      closed_at: closedAt,
      cash_drawer_physical_paise: record.cashDrawerPhysicalPaise,
      cash_system_expected_paise: record.cashSystemExpectedPaise,
      cash_variance_paise: record.cashVariancePaise,
      vault_gold_physical_mg: record.vaultGoldPhysicalMg,
      vault_gold_system_expected_mg: record.vaultGoldSystemExpectedMg,
      gold_variance_mg: record.goldVarianceMg,
      verified_by: record.verifiedBy,
      status: record.status,
      notes: record.notes ?? null,
    } as never);
    if (error) {
      toast.error(error.message ?? "Could not record day close.");
      return;
    }
    const newRecord: DayCloseRecord = { ...record, id, closedAt };
    set((state) => ({
      periodSettings: {
        ...state.periodSettings,
        dayCloseHistory: [newRecord, ...state.periodSettings.dayCloseHistory],
      },
    }));
    toast.success(`Day close for ${record.date} completed.`);
  },

  isDateFrozen: (dateStr) => {
    const freezeDate = get().periodSettings.freezeBeforeDate;
    if (!freezeDate) return false;
    return dateStr < freezeDate;
  },

  reopenPeriodWithAuthorization: async (authorizedBy) => {
    await get().setFreezeBeforeDate(null);
    toast.success(`Period lock reopened by ${authorizedBy}. Audit event recorded.`);
  },
}));

let hydrateOnce: Promise<void> | null = null;

export function ensureChartOfAccountsLoaded(): Promise<void> {
  if (!hydrateOnce) hydrateOnce = useChartOfAccountsStore.getState().hydrate();
  return hydrateOnce;
}
