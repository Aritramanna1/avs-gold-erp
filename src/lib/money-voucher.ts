/**
 * Canonical cash/bank money voucher posting spine.
 *
 * All Receipts & Payments and billing cash-mode payments post through here
 * into universal_ledger_entries via rpc_post_universal_transaction.
 * Party money and cash/bank books read the same rows — no second cash drawer.
 */
import { create } from "zustand";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { resolveFirmIdForQuery } from "@/lib/firm-scoped-query";
import {
  ensureTransactionTypesLoaded,
  postUniversalTransaction,
} from "@/lib/transaction-types-store";
import {
  ensureChartOfAccountsLoaded,
  useChartOfAccountsStore,
  type LedgerAccount,
} from "@/lib/chart-of-accounts-store";
import { usePeople } from "@/lib/people-store";
import { formatNarration } from "@/lib/ledger-narration";
import type { PaymentMode } from "@/lib/billing-store";

export type MoneyVoucherKind = "receipt" | "payment";

/** Modes that move cash/bank (not gold/outstanding placeholders). */
export const MONEY_PAYMENT_MODES: ReadonlyArray<PaymentMode> = [
  "cash",
  "anamat",
  "upi",
  "bank",
  "card",
  "cheque",
];

export function isMoneyPaymentMode(mode: PaymentMode): boolean {
  return (MONEY_PAYMENT_MODES as readonly string[]).includes(mode);
}

export interface MoneyVoucherInput {
  kind: MoneyVoucherKind;
  partyId: string;
  amountPaise: number;
  method: PaymentMode;
  /** Cash-or-bank CoA account id. Resolved from method if omitted. */
  cashOrBankAccountId?: string;
  narration?: string;
  reference?: string;
  voucherDate?: string; // YYYY-MM-DD
  invoiceId?: string;
  invoiceNo?: string;
  /** Idempotency — same source+sourceId will not double-post. */
  source: string;
  sourceId: string;
  /** Deep link back to originating document. */
  documentRoute?: string;
}

export interface MoneyVoucherResult {
  entryId: string | null;
  voucherNumber: string;
  posted: boolean;
  error?: string;
  alreadyPosted?: boolean;
}

export interface UniversalMoneyEntry {
  id: string;
  voucherNumber: string;
  voucherDate: string;
  counterpartyId: string | null;
  counterpartyName: string | null;
  cashDebitPaise: number;
  cashCreditPaise: number;
  transactionCode: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  reversalRefId: string | null;
}

function makeVoucherNumber(prefix: string): string {
  const d = new Date();
  const y = d.getFullYear().toString().slice(-2);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const seq = String(Math.floor(Math.random() * 9000) + 1000);
  return `${prefix}-${y}${m}${day}-${seq}`;
}

/** Prefer Main Cash Drawer for cash/card/upi/cheque; bank-coded accounts for bank. */
export function resolveCashOrBankAccount(
  method: PaymentMode,
  preferredAccountId?: string,
): LedgerAccount | null {
  const accounts = useChartOfAccountsStore
    .getState()
    .ledgerAccounts.filter((a) => a.isCashOrBank && a.isActive);
  if (preferredAccountId) {
    const hit = accounts.find((a) => a.id === preferredAccountId);
    if (hit) return hit;
  }
  if (method === "bank") {
    const bank = accounts.find(
      (a) =>
        a.bankAccountNumber ||
        /bank/i.test(a.name) ||
        (a.code !== "1001" && a.id !== "acc_main_cash"),
    );
    if (bank) return bank;
  }
  return (
    accounts.find((a) => a.code === "1001" || a.id === "acc_main_cash") ??
    accounts[0] ??
    null
  );
}

function accountTouchesEntry(
  entry: UniversalMoneyEntry,
  accountId: string,
): boolean {
  const m = entry.metadata ?? {};
  const ids = [
    m.debit_account_id,
    m.credit_account_id,
    m.from_account_id,
    m.to_account_id,
    m.cash_or_bank_account_id,
  ];
  return ids.some((id) => typeof id === "string" && id === accountId);
}

/**
 * Post a money receipt or payment. Requires partyId.
 * Idempotent on metadata.source + metadata.sourceId.
 */
export async function postMoneyVoucher(
  input: MoneyVoucherInput,
): Promise<MoneyVoucherResult> {
  if (!input.partyId?.trim()) {
    return {
      entryId: null,
      voucherNumber: "",
      posted: false,
      error: "Party is required.",
    };
  }
  if (!Number.isFinite(input.amountPaise) || input.amountPaise <= 0) {
    return {
      entryId: null,
      voucherNumber: "",
      posted: false,
      error: "Amount must be a positive paise integer.",
    };
  }
  if (!isMoneyPaymentMode(input.method)) {
    return {
      entryId: null,
      voucherNumber: "",
      posted: false,
      error: `Payment method ${input.method} does not post to cash/bank.`,
    };
  }

  await ensureTransactionTypesLoaded();
  await ensureChartOfAccountsLoaded();

  // Idempotency: skip if already posted
  const existing = await findEntryBySource(input.source, input.sourceId);
  if (existing) {
    return {
      entryId: existing.id,
      voucherNumber: existing.voucherNumber,
      posted: true,
      alreadyPosted: true,
    };
  }

  const person = usePeople.getState().people.find((p) => p.id === input.partyId);
  const partyName = person?.fullName ?? "Party";
  const account = resolveCashOrBankAccount(input.method, input.cashOrBankAccountId);
  if (!account) {
    return {
      entryId: null,
      voucherNumber: "",
      posted: false,
      error: "No cash/bank ledger account configured. Add one under Chart of Accounts.",
    };
  }

  const kind = input.kind;
  const transactionCode = kind === "receipt" ? "CASH_RECEIPT" : "CASH_PAYMENT";
  const prefix = kind === "receipt" ? "RCP" : "PAY";
  const voucherNumber = makeVoucherNumber(prefix);

  const label =
    kind === "receipt" ? "Payment Received" : "Payment Made";
  const narrationParts = formatNarration({
    module: input.source,
    action: label,
    party: partyName,
    reference: input.reference,
    detail: input.narration?.trim() || input.invoiceNo || undefined,
  });

  const { data: sessionData } = await supabase.auth.getSession();
  const postedBy =
    sessionData.session?.user.email ??
    sessionData.session?.user.id ??
    null;

  const cashDebitPaise = kind === "receipt" ? input.amountPaise : 0;
  const cashCreditPaise = kind === "payment" ? input.amountPaise : 0;

  const metadata: Record<string, unknown> = {
    voucherKind: kind,
    narration: narrationParts,
    party_ledger_label: label,
    payment_method: input.method,
    cash_or_bank_account_id: account.id,
    cash_or_bank_account_code: account.code,
    cash_or_bank_account_name: account.name,
    source: input.source,
    sourceId: input.sourceId,
    reference: input.reference ?? null,
    invoiceId: input.invoiceId ?? null,
    invoiceNo: input.invoiceNo ?? null,
    postedBy,
    documentRoute: input.documentRoute ?? null,
  };

  if (kind === "receipt") {
    metadata.debit_account_id = account.id;
    metadata.credit_account_id = input.partyId; // party control (receivable/payable)
  } else {
    metadata.debit_account_id = input.partyId;
    metadata.credit_account_id = account.id;
  }

  const result = await postUniversalTransaction({
    transactionCode,
    voucherNumber,
    counterpartyId: input.partyId,
    counterpartyName: partyName,
    cashDebitPaise,
    cashCreditPaise,
    metadata,
  });

  if (result.error) {
    return {
      entryId: null,
      voucherNumber,
      posted: false,
      error: result.error,
    };
  }

  // Refresh CoA running cache for the cash/bank account
  await refreshCashOrBankBalance(account.id).catch(() => undefined);
  await useMoneyVoucherStore.getState().hydrate().catch(() => undefined);

  return {
    entryId: result.entryId,
    voucherNumber,
    posted: true,
  };
}

function resolveBankChargesExpenseAccountId(): string | null {
  const accounts = useChartOfAccountsStore.getState().ledgerAccounts;
  const hit =
    accounts.find((a) => a.code === "BANK-CHG" || a.code === "BANK-CHARGES") ??
    accounts.find(
      (a) =>
        a.isActive &&
        !a.isCashOrBank &&
        /bank.?charg|charges?/i.test(`${a.code} ${a.name}`),
    ) ??
    accounts.find((a) => a.isActive && !a.isCashOrBank && /^EXP/i.test(a.code));
  return hit?.id ?? null;
}

/** Post bank charges (Dr expense / Cr bank) without requiring a customer party. */
export async function postBankChargeVoucher(input: {
  bankAccountId: string;
  amountPaise: number;
  narration: string;
  source?: string;
  sourceId: string;
  voucherDate?: string;
}): Promise<MoneyVoucherResult> {
  if (!Number.isFinite(input.amountPaise) || input.amountPaise <= 0) {
    return {
      entryId: null,
      voucherNumber: "",
      posted: false,
      error: "Amount must be a positive paise integer.",
    };
  }
  await ensureTransactionTypesLoaded();
  await ensureChartOfAccountsLoaded();

  const source = input.source ?? "bank_charge";
  const existing = await findEntryBySource(source, input.sourceId);
  if (existing) {
    return {
      entryId: existing.id,
      voucherNumber: existing.voucherNumber,
      posted: true,
      alreadyPosted: true,
    };
  }

  const bankAccount = useChartOfAccountsStore
    .getState()
    .ledgerAccounts.find((a) => a.id === input.bankAccountId);
  if (!bankAccount) {
    return {
      entryId: null,
      voucherNumber: "",
      posted: false,
      error: "Bank account not found.",
    };
  }

  const expenseAccountId = resolveBankChargesExpenseAccountId();
  const voucherNumber = makeVoucherNumber("BCH");
  const narrationParts = formatNarration({
    module: source,
    action: "Bank Charge",
    party: "Bank Charges",
    detail: input.narration,
  });

  const { data: sessionData } = await supabase.auth.getSession();
  const postedBy =
    sessionData.session?.user.email ?? sessionData.session?.user.id ?? null;

  const metadata: Record<string, unknown> = {
    voucherKind: "payment",
    narration: narrationParts,
    party_ledger_label: "Bank Charges",
    payment_method: "bank",
    cash_or_bank_account_id: bankAccount.id,
    cash_or_bank_account_code: bankAccount.code,
    cash_or_bank_account_name: bankAccount.name,
    debit_account_id: expenseAccountId ?? bankAccount.id,
    credit_account_id: bankAccount.id,
    source,
    sourceId: input.sourceId,
    bank_charge: true,
    postedBy,
    voucherDate: input.voucherDate ?? new Date().toISOString().slice(0, 10),
  };

  const result = await postUniversalTransaction({
    transactionCode: "CASH_PAYMENT",
    voucherNumber,
    counterpartyName: "Bank Charges",
    cashCreditPaise: input.amountPaise,
    metadata,
  });

  if (result.error) {
    return {
      entryId: null,
      voucherNumber,
      posted: false,
      error: result.error,
    };
  }

  await refreshCashOrBankBalance(bankAccount.id).catch(() => undefined);
  await useMoneyVoucherStore.getState().hydrate().catch(() => undefined);

  return {
    entryId: result.entryId,
    voucherNumber,
    posted: true,
  };
}

async function findEntryBySource(
  source: string,
  sourceId: string,
): Promise<UniversalMoneyEntry | null> {
  const { data, error } = await supabase
    .from("universal_ledger_entries" as never)
    .select(
      "id,voucher_number,voucher_date,counterparty_id,counterparty_name,cash_debit_paise,cash_credit_paise,metadata,created_at,reversal_ref_id,transaction_definition_id",
    )
    .contains("metadata", { source, sourceId } as never)
    .limit(1);
  if (error || !data || (data as unknown[]).length === 0) return null;
  return mapRow((data as unknown as UnivRow[])[0]);
}

interface UnivRow {
  id: string;
  voucher_number: string;
  voucher_date: string;
  counterparty_id: string | null;
  counterparty_name: string | null;
  cash_debit_paise: number;
  cash_credit_paise: number;
  metadata: Record<string, unknown> | null;
  created_at: string;
  reversal_ref_id: string | null;
  transaction_definition_id?: string | null;
  created_by?: string | null;
  universal_transaction_definitions?: { code: string; name: string } | null;
}

function mapRow(row: UnivRow): UniversalMoneyEntry {
  const m = (row.metadata ?? {}) as Record<string, unknown>;
  if (!m.postedBy && row.created_by) {
    m.postedBy = row.created_by;
  }
  return {
    id: row.id,
    voucherNumber: row.voucher_number,
    voucherDate: row.voucher_date,
    counterpartyId: row.counterparty_id,
    counterpartyName: row.counterparty_name,
    cashDebitPaise: Number(row.cash_debit_paise) || 0,
    cashCreditPaise: Number(row.cash_credit_paise) || 0,
    transactionCode: row.universal_transaction_definitions?.code ?? null,
    metadata: m,
    createdAt: row.created_at,
    reversalRefId: row.reversal_ref_id,
  };
}

/** Recompute and cache CoA current_balance_paise from vouchers + opening. */
export async function refreshCashOrBankBalance(accountId: string): Promise<number> {
  await ensureChartOfAccountsLoaded();
  const account = useChartOfAccountsStore
    .getState()
    .ledgerAccounts.find((a) => a.id === accountId);
  if (!account) return 0;

  const { data, error } = await supabase
    .from("universal_ledger_entries" as never)
    .select(
      "id,cash_debit_paise,cash_credit_paise,metadata,reversal_ref_id",
    )
    .limit(5000);
  if (error) throw error;

  let running = account.openingBalancePaise;
  for (const raw of (data ?? []) as unknown as UnivRow[]) {
    const entry = mapRow(raw);
    if (entry.reversalRefId) continue;
    if (!accountTouchesEntry(entry, accountId)) continue;
    // Receipt into this account: debit increases asset; payment: credit decreases
    const m = entry.metadata;
    if (m.debit_account_id === accountId || m.to_account_id === accountId) {
      running += entry.cashDebitPaise || entry.cashCreditPaise || 0;
    } else if (
      m.credit_account_id === accountId ||
      m.from_account_id === accountId
    ) {
      running -= entry.cashCreditPaise || entry.cashDebitPaise || 0;
    } else if (m.cash_or_bank_account_id === accountId) {
      running += entry.cashDebitPaise - entry.cashCreditPaise;
    }
  }

  await useChartOfAccountsStore.getState().updateLedgerAccount(accountId, {
    currentBalancePaise: running,
  });
  return running;
}

/** Book balance for a cash/bank account as of (inclusive) end date. */
export function computeBookBalancePaise(
  accountId: string,
  entries: UniversalMoneyEntry[],
  openingPaise: number,
  periodTo?: string,
): number {
  let running = openingPaise;
  for (const entry of entries) {
    if (entry.reversalRefId) continue;
    if (periodTo && entry.voucherDate > periodTo) continue;
    if (!accountTouchesEntry(entry, accountId)) continue;
    const m = entry.metadata;
    if (m.debit_account_id === accountId || m.to_account_id === accountId) {
      running += entry.cashDebitPaise || entry.cashCreditPaise || 0;
    } else if (
      m.credit_account_id === accountId ||
      m.from_account_id === accountId
    ) {
      running -= entry.cashCreditPaise || entry.cashDebitPaise || 0;
    } else if (m.cash_or_bank_account_id === accountId) {
      running += entry.cashDebitPaise - entry.cashCreditPaise;
    }
  }
  return running;
}

export function filterEntriesForAccount(
  accountId: string,
  entries: UniversalMoneyEntry[],
  periodFrom?: string,
  periodTo?: string,
): UniversalMoneyEntry[] {
  return entries.filter((e) => {
    if (e.reversalRefId) return false;
    if (!accountTouchesEntry(e, accountId)) return false;
    if (periodFrom && e.voucherDate < periodFrom) return false;
    if (periodTo && e.voucherDate > periodTo) return false;
    return true;
  });
}

interface MoneyVoucherState {
  entries: UniversalMoneyEntry[];
  loading: boolean;
  error: string | null;
  hydrate: () => Promise<void>;
}

export const useMoneyVoucherStore = create<MoneyVoucherState>()((set) => ({
  entries: [],
  loading: false,
  error: null,
  hydrate: async () => {
    set({ loading: true, error: null });
    try {
      const firmId = await resolveFirmIdForQuery();
      let query = supabase
        .from("universal_ledger_entries" as never)
        .select(
          "id,voucher_number,voucher_date,counterparty_id,counterparty_name,cash_debit_paise,cash_credit_paise,metadata,created_at,reversal_ref_id,created_by,universal_transaction_definitions(code,name)",
        )
        .order("voucher_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(2000);
      if (firmId) {
        query = query.eq("firm_id", firmId) as typeof query;
      }
      const { data, error } = await query;
      if (error) throw error;
      set({
        entries: ((data ?? []) as unknown as UnivRow[]).map(mapRow),
        loading: false,
      });
    } catch (err: unknown) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : "Failed to load money vouchers",
        entries: [],
      });
    }
  },
}));

export function getMoneyEntriesForParty(partyId: string): UniversalMoneyEntry[] {
  return useMoneyVoucherStore
    .getState()
    .entries.filter(
      (e) =>
        e.counterpartyId === partyId &&
        !e.reversalRefId &&
        (e.cashDebitPaise > 0 || e.cashCreditPaise > 0),
    );
}
