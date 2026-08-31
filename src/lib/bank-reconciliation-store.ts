/**
 * Bank Reconciliation — match statement closing to cash/bank book vouchers.
 * Book balance is computed from universal_ledger_entries, never typed blindly.
 */
import { create } from "zustand";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import {
  computeBookBalancePaise,
  filterEntriesForAccount,
  postBankChargeVoucher,
  useMoneyVoucherStore,
  type UniversalMoneyEntry,
} from "@/lib/money-voucher";
import {
  parseBankStatementCsv,
  suggestStatementMatches,
  statementClosingBalancePaise,
  type BankStatementLine,
} from "@/lib/bank-statement-import";
import {
  ensureChartOfAccountsLoaded,
  useChartOfAccountsStore,
} from "@/lib/chart-of-accounts-store";

export interface ClearedEntry {
  voucherId: string;
  voucherNumber: string;
  amountPaise: number;
  cleared: boolean;
}

export interface BankReconciliationSession {
  id: string;
  bankAccountCode: string;
  bankAccountId: string | null;
  periodFrom: string;
  periodTo: string;
  statementBalancePaise: number;
  bookBalancePaise: number;
  clearedEntries: ClearedEntry[];
  statementLines: BankStatementLine[];
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
  cleared_entries: ClearedEntry[] | null;
  statement_lines?: BankStatementLine[] | null;
  status: BankReconciliationSession["status"];
  notes: string | null;
  created_at: string;
};

function fromRow(row: Row): BankReconciliationSession {
  const cleared = Array.isArray(row.cleared_entries) ? row.cleared_entries : [];
  const statementLines = Array.isArray(row.statement_lines) ? row.statement_lines : [];
  return {
    id: row.id,
    bankAccountCode: row.bank_account_code,
    bankAccountId: null,
    periodFrom: row.period_from,
    periodTo: row.period_to,
    statementBalancePaise: Number(row.statement_balance_paise) || 0,
    bookBalancePaise: Number(row.book_balance_paise) || 0,
    clearedEntries: cleared.map((c) => ({
      voucherId: c.voucherId ?? c.voucherNumber,
      voucherNumber: c.voucherNumber,
      amountPaise: Number(c.amountPaise) || 0,
      cleared: !!c.cleared,
    })),
    statementLines,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

function resolveAccountId(bankAccountCode: string): string | null {
  const acc = useChartOfAccountsStore
    .getState()
    .ledgerAccounts.find((a) => a.isCashOrBank && a.code === bankAccountCode);
  return acc?.id ?? null;
}

export function computeSessionBook(
  bankAccountCode: string,
  periodFrom: string,
  periodTo: string,
): { bookPaise: number; lines: UniversalMoneyEntry[]; accountId: string | null } {
  const accountId = resolveAccountId(bankAccountCode);
  if (!accountId) return { bookPaise: 0, lines: [], accountId: null };
  const account = useChartOfAccountsStore
    .getState()
    .ledgerAccounts.find((a) => a.id === accountId);
  const all = useMoneyVoucherStore.getState().entries;
  const lines = filterEntriesForAccount(accountId, all, periodFrom, periodTo);
  const bookPaise = computeBookBalancePaise(
    accountId,
    all,
    account?.openingBalancePaise ?? 0,
    periodTo,
  );
  return { bookPaise, lines, accountId };
}

interface BankReconState {
  sessions: BankReconciliationSession[];
  loading: boolean;
  error: string | null;
  hydrate: () => Promise<void>;
  createSession: (input: {
    bankAccountCode: string;
    periodFrom: string;
    periodTo: string;
    statementBalancePaise: number;
    notes?: string | null;
  }) => Promise<BankReconciliationSession>;
  updateCleared: (
    id: string,
    clearedEntries: ClearedEntry[],
  ) => Promise<void>;
  reconcile: (id: string, notes?: string) => Promise<void>;
  importStatementCsv: (
    id: string,
    csvText: string,
  ) => Promise<{ imported: number; errors: string[] }>;
  autoMatchStatement: (id: string) => Promise<number>;
  postBankCharge: (input: {
    bankAccountCode: string;
    amountPaise: number;
    narration: string;
    sessionId?: string;
  }) => Promise<{ entryId: string | null; error?: string }>;
}

export const useBankReconciliation = create<BankReconState>()((set, get) => ({
  sessions: [],
  loading: false,
  error: null,

  hydrate: async () => {
    set({ loading: true, error: null });
    try {
      await ensureChartOfAccountsLoaded();
      await useMoneyVoucherStore.getState().hydrate();
      const { data, error } = await supabase
        .from("bank_reconciliation_sessions" as never)
        .select(
          "id,bank_account_code,period_from,period_to,statement_balance_paise,book_balance_paise,cleared_entries,statement_lines,status,notes,created_at",
        )
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      set({
        sessions: ((data ?? []) as unknown as Row[]).map(fromRow),
        loading: false,
        error: null,
      });
    } catch (err: unknown) {
      set({
        loading: false,
        error:
          err instanceof Error
            ? err.message
            : "Could not load bank reconciliation sessions.",
        sessions: [],
      });
    }
  },

  createSession: async (input) => {
    await ensureChartOfAccountsLoaded();
    await useMoneyVoucherStore.getState().hydrate();
    const { bookPaise, accountId } = computeSessionBook(
      input.bankAccountCode,
      input.periodFrom,
      input.periodTo,
    );
    if (!accountId) {
      throw new Error("Select a valid cash/bank account from Chart of Accounts.");
    }
    const { data, error } = await supabase
      .from("bank_reconciliation_sessions" as never)
      .insert({
        bank_account_code: input.bankAccountCode,
        period_from: input.periodFrom,
        period_to: input.periodTo,
        statement_balance_paise: input.statementBalancePaise,
        book_balance_paise: bookPaise,
        cleared_entries: [],
        notes: input.notes ?? null,
        status: "open",
        updated_at: new Date().toISOString(),
      } as never)
      .select(
        "id,bank_account_code,period_from,period_to,statement_balance_paise,book_balance_paise,cleared_entries,statement_lines,status,notes,created_at",
      )
      .single();
    if (error) throw error;
    await get().hydrate();
    return fromRow(data as unknown as Row);
  },

  updateCleared: async (id, clearedEntries) => {
    const session = get().sessions.find((s) => s.id === id);
    if (!session) throw new Error("Session not found.");
    const { bookPaise } = computeSessionBook(
      session.bankAccountCode,
      session.periodFrom,
      session.periodTo,
    );
    const { error } = await supabase
      .from("bank_reconciliation_sessions" as never)
      .update({
        cleared_entries: clearedEntries,
        book_balance_paise: bookPaise,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", id);
    if (error) throw error;
    await get().hydrate();
  },

  reconcile: async (id, notes) => {
    const session = get().sessions.find((s) => s.id === id);
    if (!session) throw new Error("Session not found.");
    const { bookPaise, lines } = computeSessionBook(
      session.bankAccountCode,
      session.periodFrom,
      session.periodTo,
    );
    const clearedIds = new Set(
      session.clearedEntries.filter((c) => c.cleared).map((c) => c.voucherId),
    );
    const unreconciled = lines.filter((l) => !clearedIds.has(l.id));
    const variance = session.statementBalancePaise - bookPaise;
    if (Math.abs(variance) > 0 && unreconciled.length > 0) {
      // Allow reconcile with notes documenting unreconciled items
      if (!notes?.trim()) {
        throw new Error(
          `Variance ${variance} paise with ${unreconciled.length} uncleared voucher(s). Clear lines or add notes explaining the difference.`,
        );
      }
    }
    const { error } = await supabase
      .from("bank_reconciliation_sessions" as never)
      .update({
        status: "reconciled",
        book_balance_paise: bookPaise,
        notes: notes ?? session.notes,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", id);
    if (error) throw error;
    await get().hydrate();
  },

  importStatementCsv: async (id, csvText) => {
    const session = get().sessions.find((s) => s.id === id);
    if (!session) throw new Error("Session not found.");
    const parsed = parseBankStatementCsv(csvText);
    if (parsed.lines.length === 0) {
      return { imported: 0, errors: parsed.errors };
    }
    const closing =
      parsed.closingBalancePaise ?? statementClosingBalancePaise(parsed.lines);
    const payload: Record<string, unknown> = {
      statement_lines: parsed.lines,
      updated_at: new Date().toISOString(),
    };
    if (closing != null && closing > 0) {
      payload.statement_balance_paise = closing;
    }
    const { error } = await supabase
      .from("bank_reconciliation_sessions" as never)
      .update(payload as never)
      .eq("id", id);
    if (error) throw error;
    await get().hydrate();
    return { imported: parsed.lines.length, errors: parsed.errors };
  },

  autoMatchStatement: async (id) => {
    const session = get().sessions.find((s) => s.id === id);
    if (!session) throw new Error("Session not found.");
    const { lines, accountId } = computeSessionBook(
      session.bankAccountCode,
      session.periodFrom,
      session.periodTo,
    );
    if (!accountId) return 0;
    const matchedLines = suggestStatementMatches(session.statementLines, lines);
    const matchCount = matchedLines.filter((l) => l.matchedVoucherId).length;

    const nextCleared = [...session.clearedEntries];
    for (const line of matchedLines) {
      if (!line.matchedVoucherId) continue;
      const book = lines.find((l) => l.id === line.matchedVoucherId);
      if (!book) continue;
      const amt = book.cashDebitPaise || book.cashCreditPaise;
      const idx = nextCleared.findIndex((c) => c.voucherId === book.id);
      if (idx >= 0) nextCleared[idx] = { ...nextCleared[idx], cleared: true };
      else {
        nextCleared.push({
          voucherId: book.id,
          voucherNumber: book.voucherNumber,
          amountPaise: amt,
          cleared: true,
        });
      }
    }

    const { error } = await supabase
      .from("bank_reconciliation_sessions" as never)
      .update({
        statement_lines: matchedLines,
        cleared_entries: nextCleared,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", id);
    if (error) throw error;
    await get().hydrate();
    return matchCount;
  },

  postBankCharge: async (input) => {
    await ensureChartOfAccountsLoaded();
    const accountId = resolveAccountId(input.bankAccountCode);
    if (!accountId) {
      return { entryId: null, error: "Bank account not found." };
    }
    const sourceId = `${input.sessionId ?? "adhoc"}_${input.amountPaise}_${Date.now()}`;
    const result = await postBankChargeVoucher({
      bankAccountId: accountId,
      amountPaise: input.amountPaise,
      narration: input.narration || "Bank charges",
      sourceId,
    });
    if (result.error) return { entryId: null, error: result.error };
    await useMoneyVoucherStore.getState().hydrate();
    if (input.sessionId) {
      const session = get().sessions.find((s) => s.id === input.sessionId);
      if (session) {
        const { bookPaise } = computeSessionBook(
          session.bankAccountCode,
          session.periodFrom,
          session.periodTo,
        );
        await supabase
          .from("bank_reconciliation_sessions" as never)
          .update({
            book_balance_paise: bookPaise,
            updated_at: new Date().toISOString(),
          } as never)
          .eq("id", input.sessionId);
        await get().hydrate();
      }
    }
    return { entryId: result.entryId ?? null };
  },
}));
