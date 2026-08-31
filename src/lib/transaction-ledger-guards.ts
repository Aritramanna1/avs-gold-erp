/**
 * Hard-block helpers for Transaction Module gold/cash posts.
 * Gold must come from live Gold Ledger vault lines; cash payments (when the
 * Company Cash Book is enabled) must fit the live cash ledger balance.
 */
import type { LedgerEntry } from "@/lib/ledger-store";
import {
  assertVaultGoldIssueAvailable,
  type VaultGoldPurityLine,
} from "@/lib/vault-gold-stock";
import { cashBookEnabled, requireVaultStockLine, allowNegativeStock } from "@/lib/invoice-due";
import { compileCompanyCashLedger, companyCashLedgerTotals } from "@/lib/company-cash-ledger";
import { paiseToRupees } from "@/lib/billing-store";

export function assertTransactionGoldIssueFromLedger(input: {
  entries: LedgerEntry[];
  purityPermille: number;
  fineMg: number;
  grossMg?: number;
  /** Selected VaultGoldStockSelect line id — required when vault stock lines are mandatory. */
  vaultStockLineId?: string;
}): VaultGoldPurityLine {
  if (requireVaultStockLine() && !allowNegativeStock() && !input.vaultStockLineId?.trim()) {
    throw new Error(
      "Select gold from live Gold Vault stock (ledger) before issuing. Free-text purity alone is not allowed.",
    );
  }
  return assertVaultGoldIssueAvailable({
    entries: input.entries,
    purityPermille: input.purityPermille,
    fineMg: input.fineMg,
    grossMg: input.grossMg,
  });
}

/** Refuse cash outflow when Company Cash Book closing balance cannot cover it. */
export function assertTransactionCashAvailable(amountPaise: number): void {
  if (!cashBookEnabled()) return;
  if (!Number.isFinite(amountPaise) || amountPaise <= 0) return;
  const rows = compileCompanyCashLedger();
  const { closingPaise } = companyCashLedgerTotals(rows);
  if (closingPaise < amountPaise) {
    throw new Error(
      `Insufficient Company Cash Book balance. Need ₹${paiseToRupees(amountPaise)}; available ₹${paiseToRupees(Math.max(0, closingPaise))}. Post a receipt or reduce the payment.`,
    );
  }
}
