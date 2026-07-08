/**
 * Outside Worker Statement — data assembly.
 *
 * Filters the same transaction/labour/settlement logs the ledger page reads
 * live, down to whatever period/kind was requested, and hands the result to
 * outside-worker-statement-pdf.ts to render. Kept separate from the PDF
 * renderer so a future non-PDF consumer (a portal API, a CSV export) can
 * reuse this same data-shaping logic without touching jsPDF at all.
 */
import type { OutsideWorkTransaction, OutsideWorkPosition } from "./outside-work-store";
import { computeOutsideWorkPosition } from "./outside-work-store";
import type {
  OutsideWorkLabourCharge,
  OutsideWorkPayment,
  OutsideWorkLabourPosition,
} from "./outside-work-labour-store";
import { computeOutsideWorkLabourPosition } from "./outside-work-labour-store";
import type { GoldSettlementRecord } from "./supabase-services";

export type StatementKind = "date_range" | "monthly" | "outstanding" | "settlement";

export interface OutsideWorkStatementData {
  kind: StatementKind;
  jewellerId: string;
  jewellerName: string;
  periodLabel: string;
  transactions: OutsideWorkTransaction[];
  labourCharges: OutsideWorkLabourCharge[];
  payments: OutsideWorkPayment[];
  settlements: GoldSettlementRecord[];
  position: OutsideWorkPosition;
  labourPosition: OutsideWorkLabourPosition;
}

export interface BuildStatementInput {
  kind: StatementKind;
  jewellerId: string;
  jewellerName: string;
  allTransactions: OutsideWorkTransaction[];
  allCharges: OutsideWorkLabourCharge[];
  allPayments: OutsideWorkPayment[];
  allSettlements: GoldSettlementRecord[];
  /** Required for "date_range" and implied ("this month") for "monthly". */
  fromTs?: number;
  toTs?: number;
}

function inRange(ts: number, fromTs?: number, toTs?: number): boolean {
  if (fromTs !== undefined && ts < fromTs) return false;
  if (toTs !== undefined && ts > toTs) return false;
  return true;
}

function currentMonthRange(): { fromTs: number; toTs: number; label: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  const label = from.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  return { fromTs: from.getTime(), toTs: to.getTime(), label };
}

/**
 * Builds statement data for one of four kinds:
 *  - date_range: everything between fromTs/toTs (both required)
 *  - monthly: everything in the current calendar month (fromTs/toTs ignored)
 *  - outstanding: every unsettled charge/txn regardless of date — a
 *    snapshot of what's currently owed, not a period report
 *  - settlement: only the settlement history (Gold + Labour), regardless of date
 */
export function buildOutsideWorkStatement(input: BuildStatementInput): OutsideWorkStatementData {
  const {
    kind,
    jewellerId,
    jewellerName,
    allTransactions,
    allCharges,
    allPayments,
    allSettlements,
  } = input;

  const jewellerTxns = allTransactions.filter((t) => t.jewellerId === jewellerId);
  const jewellerCharges = allCharges.filter((c) => c.jewellerId === jewellerId);
  const jewellerPayments = allPayments.filter((p) => p.jewellerId === jewellerId);
  const jewellerSettlements = allSettlements.filter((s) => s.party_id === jewellerId);

  let fromTs = input.fromTs;
  let toTs = input.toTs;
  let periodLabel = "All time";

  if (kind === "monthly") {
    const range = currentMonthRange();
    fromTs = range.fromTs;
    toTs = range.toTs;
    periodLabel = range.label;
  } else if (kind === "date_range") {
    periodLabel =
      fromTs && toTs
        ? `${new Date(fromTs).toLocaleDateString("en-IN")} – ${new Date(toTs).toLocaleDateString("en-IN")}`
        : "All time";
  } else if (kind === "outstanding") {
    periodLabel = "Current outstanding (all time)";
  } else if (kind === "settlement") {
    periodLabel = "Settlement history (all time)";
  }

  const filteredTxns =
    kind === "date_range" || kind === "monthly"
      ? jewellerTxns.filter((t) => inRange(t.ts, fromTs, toTs))
      : kind === "settlement"
        ? []
        : jewellerTxns;

  const filteredCharges =
    kind === "date_range" || kind === "monthly"
      ? jewellerCharges.filter((c) => inRange(c.ts, fromTs, toTs))
      : kind === "settlement"
        ? []
        : jewellerCharges;

  const filteredPayments =
    kind === "date_range" || kind === "monthly"
      ? jewellerPayments.filter((p) => inRange(p.ts, fromTs, toTs))
      : kind === "settlement"
        ? []
        : jewellerPayments;

  const filteredSettlements =
    kind === "date_range" || kind === "monthly"
      ? jewellerSettlements.filter((s) =>
          inRange(new Date(s.settlement_date).getTime(), fromTs, toTs),
        )
      : jewellerSettlements;

  // Position figures always reflect the FULL history (running balances),
  // never the filtered period — a statement shows activity for the period
  // but the balance carried is always the true, current one.
  const position = computeOutsideWorkPosition(jewellerTxns);
  const labourPosition = computeOutsideWorkLabourPosition(jewellerCharges, jewellerPayments);

  return {
    kind,
    jewellerId,
    jewellerName,
    periodLabel,
    transactions: filteredTxns.sort((a, b) => b.ts - a.ts),
    labourCharges: filteredCharges.sort((a, b) => b.ts - a.ts),
    payments: filteredPayments.sort((a, b) => b.ts - a.ts),
    settlements: filteredSettlements.sort(
      (a, b) => new Date(b.settlement_date).getTime() - new Date(a.settlement_date).getTime(),
    ),
    position,
    labourPosition,
  };
}
