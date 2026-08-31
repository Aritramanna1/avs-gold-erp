/**
 * Manufacturing Books — Jeweller Book period statement builder.
 *
 * The Jeweller Book runs on the shared customer-account-ledger (gold AND cash),
 * so it can't use the gold-only workshop-ledger.buildLedgerView the Worker Book
 * uses. This is the gold+cash equivalent: it windows a compiled jeweller ledger
 * to a chosen period, carries the balance forward as an Opening Balance, inserts
 * automatic Weekly and Monthly Closing→Opening breaks, and closes with a final
 * Closing Balance — giving the Jeweller Book the SAME period/closing behaviour
 * the Worker Book already has, consistently.
 *
 * Purely presentational: it reads the running closing balances the ledger
 * compiler already struck (closingGoldMg / closingMoneyPaise) and never
 * re-computes money — a closing line only echoes the boundary row's own balance.
 */
import type { CustomerLedgerRow } from "@/lib/customer-account-ledger";
import type { PeriodRange } from "@/lib/workshop-ledger";

export interface JewellerLedgerLine {
  kind: "opening" | "txn" | "weekly-closing" | "monthly-closing" | "closing";
  id: string;
  date: string;
  voucherNo: string;
  type: string;
  description: string;
  purity?: number;
  goldInMg: number;
  goldOutMg: number;
  moneyDebitPaise: number;
  moneyCreditPaise: number;
  closingGoldMg: number;
  closingMoneyPaise: number;
  cashGoldEquivMg?: number;
  ratePerGramPaise?: number;
  /**
   * On a closing line only: the totals accumulated since the previous opening —
   * that week's / month's / period's Gold Received & Issued and Debit & Credit,
   * shown alongside the running balances so a closing is a full summary. On
   * closing lines `goldInMg`/`goldOutMg`/`moneyDebitPaise`/`moneyCreditPaise`
   * ARE these segment totals (0 on opening/txn is meaningless for those).
   */
  isSummary?: boolean;
}

export interface JewellerPeriodSummary {
  openingGoldMg: number;
  totalGoldInMg: number;
  totalGoldOutMg: number;
  closingGoldMg: number;
  openingMoneyPaise: number;
  totalDebitPaise: number;
  totalCreditPaise: number;
  closingMoneyPaise: number;
}

export interface JewellerPeriodView {
  lines: JewellerLedgerLine[];
  summary: JewellerPeriodSummary;
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
function fmt(ts: number): string {
  return new Date(ts).toLocaleDateString("en-IN", { dateStyle: "medium" });
}

interface SegTotals {
  goldIn: number;
  goldOut: number;
  debit: number;
  credit: number;
}

function openingLine(
  id: string,
  date: string,
  description: string,
  gold: number,
  money: number,
): JewellerLedgerLine {
  return {
    kind: "opening",
    id,
    date,
    voucherNo: "",
    type: "Opening",
    description,
    goldInMg: 0,
    goldOutMg: 0,
    moneyDebitPaise: 0,
    moneyCreditPaise: 0,
    closingGoldMg: gold,
    closingMoneyPaise: money,
  };
}

/** A closing line — carries the segment's Received/Issued/Debit/Credit totals AND the running balances. */
function closingLine(
  kind: "weekly-closing" | "monthly-closing" | "closing",
  id: string,
  date: string,
  description: string,
  gold: number,
  money: number,
  seg: SegTotals,
): JewellerLedgerLine {
  return {
    kind,
    id,
    date,
    voucherNo: "",
    type: "Closing",
    description,
    goldInMg: seg.goldIn,
    goldOutMg: seg.goldOut,
    moneyDebitPaise: seg.debit,
    moneyCreditPaise: seg.credit,
    closingGoldMg: gold,
    closingMoneyPaise: money,
    isSummary: true,
  };
}

/**
 * Build a period statement for one jeweller ledger. Opening carried forward,
 * period transactions with automatic weekly/monthly closing breaks, final
 * closing balance, and a period summary (the eight figures the owner reads).
 * `rows` must be chronological with running balances already struck.
 */
export function buildJewellerPeriodView(
  rows: CustomerLedgerRow[],
  period: PeriodRange,
): JewellerPeriodView {
  const inRange = rows.filter((r) => r.ts >= period.from && r.ts <= period.to);
  const prior = rows.filter((r) => r.ts < period.from);

  // Opening = the balance the book stood at just before the period's first row.
  const openingGold = prior.length ? prior[prior.length - 1].closingGoldMg : 0;
  const openingMoney = prior.length ? prior[prior.length - 1].closingMoneyPaise : 0;

  const startDate = fmt(period.from);
  const lines: JewellerLedgerLine[] = [
    openingLine(
      "opening",
      startDate,
      "Opening Balance (carried forward)",
      openingGold,
      openingMoney,
    ),
  ];

  let totalGoldIn = 0;
  let totalGoldOut = 0;
  let totalDebit = 0;
  let totalCredit = 0;
  // Per-segment totals — reset at each weekly/monthly closing so every closing
  // reports its OWN week's / month's Received/Issued/Debit/Credit.
  let seg: SegTotals = { goldIn: 0, goldOut: 0, debit: 0, credit: 0 };
  const resetSeg = () => (seg = { goldIn: 0, goldOut: 0, debit: 0, credit: 0 });
  let prev: CustomerLedgerRow | null = null;

  for (const r of inRange) {
    if (prev) {
      if (monthKey(r.ts) !== monthKey(prev.ts)) {
        lines.push(
          closingLine(
            "monthly-closing",
            `mc-${prev.id}`,
            prev.date,
            `Closing Balance — ${monthLabel(prev.ts)}`,
            prev.closingGoldMg,
            prev.closingMoneyPaise,
            seg,
          ),
        );
        lines.push(
          openingLine(
            `mo-${r.id}`,
            r.date,
            `Opening Balance — ${monthLabel(r.ts)} (carried forward)`,
            prev.closingGoldMg,
            prev.closingMoneyPaise,
          ),
        );
        resetSeg();
      } else if (weekKey(r.ts) !== weekKey(prev.ts)) {
        lines.push(
          closingLine(
            "weekly-closing",
            `wc-${prev.id}`,
            prev.date,
            "Weekly Closing Balance",
            prev.closingGoldMg,
            prev.closingMoneyPaise,
            seg,
          ),
        );
        lines.push(
          openingLine(
            `wo-${r.id}`,
            r.date,
            "Opening Balance (carried forward)",
            prev.closingGoldMg,
            prev.closingMoneyPaise,
          ),
        );
        resetSeg();
      }
    }
    lines.push({
      kind: "txn",
      id: r.id,
      date: r.date,
      voucherNo: r.voucherNo,
      type: r.type,
      description: r.description,
      purity: r.purity,
      goldInMg: r.goldInMg,
      goldOutMg: r.goldOutMg,
      moneyDebitPaise: r.moneyDebitPaise,
      moneyCreditPaise: r.moneyCreditPaise,
      closingGoldMg: r.closingGoldMg,
      closingMoneyPaise: r.closingMoneyPaise,
      cashGoldEquivMg: r.cashGoldEquivMg,
      ratePerGramPaise: r.ratePerGramPaise,
    });
    totalGoldIn += r.goldInMg;
    totalGoldOut += r.goldOutMg;
    totalDebit += r.moneyDebitPaise;
    totalCredit += r.moneyCreditPaise;
    seg.goldIn += r.goldInMg;
    seg.goldOut += r.goldOutMg;
    seg.debit += r.moneyDebitPaise;
    seg.credit += r.moneyCreditPaise;
    prev = r;
  }

  const closingGold = prev ? prev.closingGoldMg : openingGold;
  const closingMoney = prev ? prev.closingMoneyPaise : openingMoney;
  lines.push(
    closingLine(
      "closing",
      "closing",
      prev ? prev.date : startDate,
      "Closing Balance",
      closingGold,
      closingMoney,
      seg,
    ),
  );

  return {
    lines,
    summary: {
      openingGoldMg: openingGold,
      totalGoldInMg: totalGoldIn,
      totalGoldOutMg: totalGoldOut,
      closingGoldMg: closingGold,
      openingMoneyPaise: openingMoney,
      totalDebitPaise: totalDebit,
      totalCreditPaise: totalCredit,
      closingMoneyPaise: closingMoney,
    },
    txnCount: inRange.length,
    period,
  };
}
