/**
 * Bridge operational voucher flows to configured universal transaction definitions.
 * Called after authoritative domain RPCs succeed — never rolls back on failure.
 */
import { postUniversalTransaction } from "@/lib/transaction-types-store";

const VOUCHER_CODE_MAP: Record<string, string> = {
  invoice: "SALES_INVOICE",
  sales_invoice: "SALES_INVOICE",
  purchase: "PURCHASE_VOUCHER",
  supplier_purchase: "PURCHASE_VOUCHER",
  settlement: "GOLD_SETTLEMENT",
  gold_settlement: "GOLD_SETTLEMENT",
  stock_entry: "STOCK_RECEIPT",
  conversion: "METAL_CONVERSION",
  metal_conversion: "METAL_CONVERSION",
  credit_note: "CREDIT_NOTE",
  debit_note: "DEBIT_NOTE",
};

export type UniversalVoucherBridgeInput = {
  voucherKind: string;
  voucherNumber: string;
  counterpartyId?: string;
  counterpartyName?: string;
  grossWeightMg?: number;
  netWeightMg?: number;
  fineGoldDebitMg?: number;
  fineGoldCreditMg?: number;
  cashDebitPaise?: number;
  cashCreditPaise?: number;
  metadata?: Record<string, unknown>;
};

/** Attempt ledger post when a matching universal transaction type is active. */
export async function tryPostUniversalLedgerMirror(
  input: UniversalVoucherBridgeInput,
): Promise<{ posted: boolean; entryId?: string; error?: string }> {
  const code =
    VOUCHER_CODE_MAP[input.voucherKind] ??
    input.voucherKind.toUpperCase().replace(/[^A-Z0-9]+/g, "_");

  const result = await postUniversalTransaction({
    transactionCode: code,
    voucherNumber: input.voucherNumber,
    counterpartyId: input.counterpartyId,
    counterpartyName: input.counterpartyName,
    grossWeightMg: input.grossWeightMg,
    netWeightMg: input.netWeightMg,
    fineGoldDebitMg: input.fineGoldDebitMg,
    fineGoldCreditMg: input.fineGoldCreditMg,
    cashDebitPaise: input.cashDebitPaise,
    cashCreditPaise: input.cashCreditPaise,
    metadata: input.metadata,
  });

  if (result.error?.includes("is not active")) {
    return { posted: false };
  }
  if (result.error) {
    console.warn("[UniversalTxnBridge]", code, result.error);
    return { posted: false, error: result.error };
  }
  return { posted: true, entryId: result.entryId ?? undefined };
}
