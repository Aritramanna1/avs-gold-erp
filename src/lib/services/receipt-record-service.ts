import { createRepository } from "@/lib/repositories/base-repository";
import type { PrintDocType } from "@/lib/printlog-store";

export interface ReceiptRecord {
  table: string;
  data: Record<string, any>;
  kind?: string;
}

const TABLE_BY_DOC: Partial<Record<PrintDocType, string>> = {
  order_slip: "orders",
  gold_receipt: "orders",
  old_gold_receipt: "orders",
  advance_receipt: "orders",
  job_card: "job_cards",
  gold_issue_slip: "job_cards",
  gold_receive_slip: "job_cards",
  filings_receipt: "job_cards",
  gst_invoice: "invoices",
  retail_invoice: "invoices",
  payment_receipt: "invoices",
  repair_receipt: "repairs",
  repair_delivery_slip: "repairs",
  repair_invoice: "repairs",
  polishing_receipt: "repairs",
  daily_close_report: "daily_close",
  jewellery_tag: "inventory",
  worker_kyc: "people",
  gold_settlement: "gold_settlements",
  home_settlement_slip: "worker_settlements",
  gold_advance_slip: "worker_transactions",
  wastage_return_receipt: "worker_transactions",
  loan_slip: "worker_transactions",
  withdrawal_slip: "worker_transactions",
};

const repositories = new Map<string, ReturnType<typeof createRepository<any>>>();

function repository(table: string) {
  let value = repositories.get(table);
  if (!value) {
    value = createRepository<any>(table);
    repositories.set(table, value);
  }
  return value;
}

export async function findReceiptRecordById(
  docType: PrintDocType,
  id: string,
): Promise<ReceiptRecord | null> {
  const table = TABLE_BY_DOC[docType];
  if (!table) return null;
  const data = await repository(table).read(id);
  if (!data) return null;
  return { table, data, kind: data.kind };
}

const NUMBER_LOOKUPS = [
  { table: "job_cards", fields: ["jobNo", "job_no"] },
  { table: "orders", fields: ["orderNo", "order_no"] },
  { table: "invoices", fields: ["invoiceNo", "invoice_no"] },
  { table: "repairs", fields: ["repairNo", "repair_no"] },
  { table: "rate_cut_records", fields: ["rateCutNo", "rate_cut_no", "slipNo"] },
] as const;

export async function findReceiptRecordByNumber(code: string): Promise<ReceiptRecord | null> {
  const wanted = code.trim();
  for (const lookup of NUMBER_LOOKUPS) {
    const rows = await repository(lookup.table).readAll();
    const data = rows.find((row) =>
      lookup.fields.some((field) => String(row[field] ?? "") === wanted),
    );
    if (data) return { table: lookup.table, data, kind: data.kind };
  }
  return null;
}
