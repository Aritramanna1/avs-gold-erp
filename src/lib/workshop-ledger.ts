/**
 * Workshop — shared ledger presentation layer for the per-purity gold books
 * (Worker, Outside Worker, Polishing).
 *
 * These books only RECORD transactions and balances. No salary, wastage or
 * deduction maths lives here — that is the (configurable) Payment module's job.
 * This module turns a purity book's raw running rows into a period statement a
 * non-technical owner can read and audit:
 *
 *  - the user picks a period (This Week … Financial Year, or a custom range)
 *    before sharing, instead of dumping the entire book every time;
 *  - each period opens with the balance carried forward (Opening Balance) and
 *    closes with a Closing Balance;
 *  - week and month boundaries inside the period get their own Closing/Opening
 *    pair, so a printed ledger reads like the physical book.
 */

// ── Period selection ────────────────────────────────────────────────────────

export type LedgerPeriodKey =
  | "this_week"
  | "this_month"
  | "last_month"
  | "this_quarter"
  | "this_year"
  | "financial_year"
  | "custom"
  | "all";

export interface LedgerPeriodOption {
  key: LedgerPeriodKey;
  label: string;
}

/** Ledger-sharing periods, in the order they appear in the picker. */
export const LEDGER_PERIODS: LedgerPeriodOption[] = [
  { key: "this_week", label: "This Week" },
  { key: "this_month", label: "This Month" },
  { key: "last_month", label: "Last Month" },
  { key: "this_quarter", label: "This Quarter" },
  { key: "this_year", label: "This Year" },
  { key: "financial_year", label: "Financial Year" },
  { key: "custom", label: "Custom Date Range" },
  { key: "all", label: "All Time" },
];

export interface PeriodRange {
  from: number;
  to: number;
  label: string;
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}
function endOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime();
}
function fmt(ts: number): string {
  return new Date(ts).toLocaleDateString("en-IN", { dateStyle: "medium" });
}

/**
 * Resolves a period key to an absolute [from, to] window plus a human label.
 * Weeks start Monday. The financial year is the Indian April–March year.
 * `customFrom`/`customTo` are `yyyy-mm-dd` strings (from <input type="date">).
 */
export function resolvePeriod(
  key: LedgerPeriodKey,
  customFrom?: string,
  customTo?: string,
): PeriodRange {
  const now = new Date();
  const todayEnd = endOfDay(now);

  switch (key) {
    case "this_week": {
      // Monday as the first day of the week.
      const day = (now.getDay() + 6) % 7; // 0 = Monday
      const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
      const from = startOfDay(monday);
      return { from, to: todayEnd, label: `This Week (${fmt(from)} – ${fmt(todayEnd)})` };
    }
    case "this_month": {
      const from = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      return { from, to: todayEnd, label: `This Month (${fmt(from)} – ${fmt(todayEnd)})` };
    }
    case "last_month": {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
      const to = endOfDay(new Date(now.getFullYear(), now.getMonth(), 0));
      return { from, to, label: `Last Month (${fmt(from)} – ${fmt(to)})` };
    }
    case "this_quarter": {
      const q = Math.floor(now.getMonth() / 3);
      const from = new Date(now.getFullYear(), q * 3, 1).getTime();
      return { from, to: todayEnd, label: `This Quarter (${fmt(from)} – ${fmt(todayEnd)})` };
    }
    case "this_year": {
      const from = new Date(now.getFullYear(), 0, 1).getTime();
      return { from, to: todayEnd, label: `This Year (${fmt(from)} – ${fmt(todayEnd)})` };
    }
    case "financial_year": {
      // April (month 3) starts the Indian FY; before April we're still in the
      // FY that began last calendar year.
      const fyStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
      const from = new Date(fyStartYear, 3, 1).getTime();
      const to = endOfDay(new Date(fyStartYear + 1, 2, 31));
      return {
        from,
        to,
        label: `Financial Year ${fyStartYear}–${String(fyStartYear + 1).slice(2)}`,
      };
    }
    case "custom": {
      const from = customFrom ? startOfDay(new Date(customFrom)) : 0;
      const to = customTo ? endOfDay(new Date(customTo)) : todayEnd;
      return { from, to, label: `${fmt(from)} – ${fmt(to)}` };
    }
    case "all":
    default:
      return { from: 0, to: todayEnd, label: "All Time" };
  }
}

// ── Ledger statement construction ───────────────────────────────────────────

/**
 * A book's raw running row, in chronological order (oldest first). `receivedMg`
 * is gold coming back IN, `issuedMg` is gold going OUT — the running balance is
 * already computed by the book compiler and carried here unchanged.
 */
export interface RawLedgerEntry {
  ts: number;
  date: string;
  refNo: string;
  /** Daily Material Slip number this row traces back to (Worker books). Optional — other ledgers omit it. */
  slipNo?: string;
  description: string;
  orderNo?: string;
  receivedMg: number;
  issuedMg: number;
  runningBalanceMg: number;
  previousBalanceMg: number;
}

export interface LedgerLine {
  kind: "opening" | "txn" | "closing";
  date: string;
  refNo: string;
  /** Daily Material Slip number (Worker books). Undefined on opening/closing lines and non-worker ledgers. */
  slipNo?: string;
  description: string;
  orderNo?: string;
  receivedMg: number;
  issuedMg: number;
  balanceMg: number;
  /**
   * On a closing line only: the totals accumulated since the previous
   * opening — that week's / month's / period's Gold Received and Issued, shown
   * alongside the Running Gold Balance so a closing is a full summary, not just
   * a balance. Undefined on opening/txn lines.
   */
  periodReceivedMg?: number;
  periodIssuedMg?: number;
}

export interface LedgerView {
  lines: LedgerLine[];
  openingBalanceMg: number;
  closingBalanceMg: number;
  totalReceivedMg: number;
  totalIssuedMg: number;
  txnCount: number;
  period: PeriodRange;
}

function monthKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}`;
}
function monthLabel(ts: number): string {
  return new Date(ts).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}
/** Monday-based week index since the epoch — a stable key for "same week". */
function weekKey(ts: number): number {
  const d = new Date(ts);
  const midday = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12).getTime();
  return Math.floor((midday - 4 * 86400000) / (7 * 86400000)); // epoch Thu → shift to Monday
}

function openingLine(balanceMg: number, date: string): LedgerLine {
  return {
    kind: "opening",
    date,
    refNo: "",
    description: "Opening Balance (carried forward)",
    receivedMg: 0,
    issuedMg: 0,
    balanceMg,
  };
}
function closingLine(
  balanceMg: number,
  date: string,
  label: string,
  periodReceivedMg: number,
  periodIssuedMg: number,
): LedgerLine {
  return {
    kind: "closing",
    date,
    refNo: "",
    description: label,
    receivedMg: 0,
    issuedMg: 0,
    balanceMg,
    periodReceivedMg,
    periodIssuedMg,
  };
}

/**
 * Builds a period statement for one purity book: opening balance carried
 * forward, the period's transactions with automatic weekly/monthly
 * Closing→Opening breaks, and a final Closing Balance. Purely presentational —
 * it never re-computes a running balance, only reads the ones the compiler set.
 */
export function buildLedgerView(chrono: RawLedgerEntry[], period: PeriodRange): LedgerView {
  const inRange = chrono.filter((r) => r.ts >= period.from && r.ts <= period.to);

  // Opening = balance the book stood at just before the period's first row.
  // With no rows in range, carry the last balance from before the window.
  let opening = 0;
  if (inRange.length > 0) {
    opening = inRange[0].previousBalanceMg;
  } else {
    const prior = chrono.filter((r) => r.ts < period.from);
    opening = prior.length ? prior[prior.length - 1].runningBalanceMg : 0;
  }

  const startDate = fmt(period.from);
  const lines: LedgerLine[] = [openingLine(opening, startDate)];

  let totalReceived = 0;
  let totalIssued = 0;
  // Per-segment totals — reset at each weekly/monthly closing so every closing
  // line reports the Gold Received / Issued for its OWN week or month, not the
  // whole period.
  let segReceived = 0;
  let segIssued = 0;
  let prev: RawLedgerEntry | null = null;

  for (const r of inRange) {
    if (prev) {
      if (monthKey(r.ts) !== monthKey(prev.ts)) {
        // Month rolled over inside the period — close the month, reopen next.
        lines.push(
          closingLine(
            prev.runningBalanceMg,
            prev.date,
            `Closing Balance — ${monthLabel(prev.ts)}`,
            segReceived,
            segIssued,
          ),
        );
        lines.push(openingLine(prev.runningBalanceMg, r.date));
        segReceived = 0;
        segIssued = 0;
      } else if (weekKey(r.ts) !== weekKey(prev.ts)) {
        lines.push(
          closingLine(
            prev.runningBalanceMg,
            prev.date,
            "Weekly Closing Balance",
            segReceived,
            segIssued,
          ),
        );
        lines.push(openingLine(prev.runningBalanceMg, r.date));
        segReceived = 0;
        segIssued = 0;
      }
    }
    lines.push({
      kind: "txn",
      date: r.date,
      refNo: r.refNo,
      slipNo: r.slipNo,
      description: r.description,
      orderNo: r.orderNo,
      receivedMg: r.receivedMg,
      issuedMg: r.issuedMg,
      balanceMg: r.runningBalanceMg,
    });
    totalReceived += r.receivedMg;
    totalIssued += r.issuedMg;
    segReceived += r.receivedMg;
    segIssued += r.issuedMg;
    prev = r;
  }

  const closing = prev ? prev.runningBalanceMg : opening;
  lines.push(
    closingLine(closing, prev ? prev.date : startDate, "Closing Balance", segReceived, segIssued),
  );

  return {
    lines,
    openingBalanceMg: opening,
    closingBalanceMg: closing,
    totalReceivedMg: totalReceived,
    totalIssuedMg: totalIssued,
    txnCount: inRange.length,
    period,
  };
}
