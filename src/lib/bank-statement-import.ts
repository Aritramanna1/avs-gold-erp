/**
 * Bank statement CSV import — parse common Indian bank export formats and
 * suggest matches against cash/bank book vouchers.
 */
import type { UniversalMoneyEntry } from "@/lib/money-voucher";

export interface BankStatementLine {
  id: string;
  date: string;
  narration: string;
  debitPaise: number;
  creditPaise: number;
  balancePaise?: number;
  matchedVoucherId?: string | null;
}

function parseIndianDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) {
    const dd = dmy[1].padStart(2, "0");
    const mm = dmy[2].padStart(2, "0");
    return `${dmy[3]}-${mm}-${dd}`;
  }
  // DD-MMM-YYYY
  const parsed = Date.parse(s);
  if (Number.isFinite(parsed)) return new Date(parsed).toISOString().slice(0, 10);
  return null;
}

function parseAmountRs(raw: string): number {
  const cleaned = raw.replace(/[₹,\s"]/g, "").trim();
  if (!cleaned || cleaned === "-") return 0;
  const n = Number.parseFloat(cleaned);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function headerIndex(headers: string[], ...aliases: string[]): number {
  const norm = headers.map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ""));
  for (const alias of aliases) {
    const key = alias.toLowerCase().replace(/[^a-z0-9]/g, "");
    const idx = norm.findIndex((h) => h.includes(key) || key.includes(h));
    if (idx >= 0) return idx;
  }
  return -1;
}

export function parseBankStatementCsv(text: string): {
  lines: BankStatementLine[];
  errors: string[];
  closingBalancePaise?: number;
} {
  const errors: string[] = [];
  const rawLines = text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (rawLines.length < 2) {
    return { lines: [], errors: ["CSV must include a header row and at least one transaction."] };
  }

  const header = splitCsvLine(rawLines[0]);
  const dateIdx = headerIndex(header, "date", "txn date", "transaction date", "value date");
  const narrIdx = headerIndex(
    header,
    "narration",
    "description",
    "particulars",
    "remarks",
    "details",
  );
  const debitIdx = headerIndex(header, "debit", "withdrawal", "dr", "paid out");
  const creditIdx = headerIndex(header, "credit", "deposit", "cr", "paid in");
  const balanceIdx = headerIndex(header, "balance", "closing balance", "running balance");
  const amountIdx = headerIndex(header, "amount");

  if (dateIdx < 0) {
    errors.push("Could not find a Date column in the CSV header.");
    return { lines: [], errors };
  }

  const lines: BankStatementLine[] = [];
  let closingBalancePaise: number | undefined;

  for (let i = 1; i < rawLines.length; i++) {
    const cols = splitCsvLine(rawLines[i]);
    const date = parseIndianDate(cols[dateIdx] ?? "");
    if (!date) {
      errors.push(`Row ${i + 1}: invalid date "${cols[dateIdx] ?? ""}"`);
      continue;
    }
    let debitPaise = debitIdx >= 0 ? parseAmountRs(cols[debitIdx] ?? "") : 0;
    let creditPaise = creditIdx >= 0 ? parseAmountRs(cols[creditIdx] ?? "") : 0;
    if (debitIdx < 0 && creditIdx < 0 && amountIdx >= 0) {
      const amt = parseAmountRs(cols[amountIdx] ?? "");
      if (amt < 0) debitPaise = Math.abs(amt);
      else creditPaise = amt;
    }
    const narration =
      (narrIdx >= 0 ? cols[narrIdx] : cols.filter((_, j) => j !== dateIdx).join(" ")) || "—";
    const balancePaise = balanceIdx >= 0 ? parseAmountRs(cols[balanceIdx] ?? "") : undefined;
    if (balancePaise != null && balancePaise > 0) closingBalancePaise = balancePaise;

    lines.push({
      id: `stmt_${i}_${date}`,
      date,
      narration: narration.slice(0, 240),
      debitPaise,
      creditPaise,
      balancePaise,
      matchedVoucherId: null,
    });
  }

  if (lines.length === 0 && errors.length === 0) {
    errors.push("No valid statement rows parsed.");
  }

  return { lines, errors, closingBalancePaise };
}

/** Match statement lines to book vouchers by amount (+/- 3 days). */
export function suggestStatementMatches(
  statementLines: BankStatementLine[],
  bookLines: UniversalMoneyEntry[],
): BankStatementLine[] {
  const used = new Set<string>();
  return statementLines.map((line) => {
    const targetPaise = line.debitPaise > 0 ? line.debitPaise : line.creditPaise;
    if (targetPaise <= 0) return line;
    const lineMs = Date.parse(`${line.date}T12:00:00.000Z`);
    let best: UniversalMoneyEntry | null = null;
    let bestDelta = Infinity;
    for (const book of bookLines) {
      if (used.has(book.id)) continue;
      const bookAmt = book.cashDebitPaise || book.cashCreditPaise;
      if (bookAmt !== targetPaise) continue;
      const bookMs = Date.parse(`${book.voucherDate}T12:00:00.000Z`);
      const delta = Math.abs(bookMs - lineMs);
      if (delta <= 3 * 86_400_000 && delta < bestDelta) {
        best = book;
        bestDelta = delta;
      }
    }
    if (best) {
      used.add(best.id);
      return { ...line, matchedVoucherId: best.id };
    }
    return line;
  });
}

export function statementClosingBalancePaise(lines: BankStatementLine[]): number | undefined {
  if (lines.length === 0) return undefined;
  const lastWithBal = [...lines].reverse().find((l) => l.balancePaise != null && l.balancePaise > 0);
  return lastWithBal?.balancePaise;
}
