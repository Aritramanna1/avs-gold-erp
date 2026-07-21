/**
 * Workshop — Jeweller Books.
 *
 * The digital form of the physical jeweller ledger the workshop keeps today:
 * one book per client jeweller (the customer/firm who sends gold for job-work),
 * holding their gold in/out, their orders, the job cards those orders spawned,
 * the manufacturing bills, the settlements, and a running gold + cash balance.
 *
 * This is a COMPILER, not a store: every figure is derived from the existing
 * stores (orders, job cards, manufacturing bills, gold settlements) and from
 * compileCustomerLedger(), which already owns the chronological running-balance
 * logic. No second source of truth for a gold balance, and nothing new to keep
 * in sync.
 *
 * Offline-first: this compiler reads ONLY local zustand store state
 * (`useX.getState()`) — never Supabase, never the network. The local database
 * is the source of truth for day-to-day operation; the cloud is for optional
 * backup/sync only. A jeweller book renders fully with no connection.
 *
 * Out of scope on purpose: the Karigar / Worker Gold Book is the TRANSACTION
 * module (where issues/returns are entered); Workshop only stores and displays
 * the ledger history those transactions generate. Outside Worker and Polishing
 * are ledger SECTIONS inside Workshop (see workshop-book-types.ts).
 */
import {
  compileCustomerLedger,
  summariseLedgerRows,
  type CustomerLedgerRow,
  type CustomerLedgerSummary,
} from "./customer-account-ledger";
import { useOrders, type Order } from "./orders-store";
import { useJobCards, normalizeJobStatus, type JobCard } from "./jobcards-store";
import { useMfgBills, type ManufacturingBill } from "./manufacturing-bill-store";
import { useGoldSettlement } from "./gold-settlement-store";
import { usePeople, type Person, type PersonType } from "./people-store";
import { contributedRowsFor } from "./workshop-ledger-sources";

/** The party types that hold a jeweller book. Karigars/workers/vendors keep their own separate books. */
export const JEWELLER_TYPES: PersonType[] = ["customer", "firm_customer"];

export interface JewellerBook {
  jeweller: Person;
  /**
   * One unified money+gold ledger (settlements, orders, invoices and any
   * registered payment contributions) with a single running balance. Purity is
   * recorded per row, NOT split into separate books — a jeweller keeps one
   * ledger that always states the purity received/issued/settled/delivered.
   */
  ledger: CustomerLedgerSummary;

  orders: Order[];
  jobCards: JobCard[];
  bills: ManufacturingBill[];
  /** Gold + cash settlement records posted against this jeweller. */
  settlements: ReturnType<typeof useGoldSettlement.getState>["settlements"];

  /** Fine gold this jeweller has handed us, lifetime. */
  goldReceivedMg: number;
  /** Fine gold issued back out to them (finished goods, returns, adjustments), lifetime. */
  goldIssuedMg: number;
  /** Fine gold of theirs still lying with us (they are in credit). */
  goldHeldMg: number;
  /** Fine gold they owe us (we issued more than they gave). */
  goldOwedMg: number;

  /** Cash they owe us. */
  cashDuePaise: number;
  /** Cash sitting with us as their advance. */
  cashAdvancePaise: number;

  openOrders: number;
  openJobCards: number;
  deliveredPieces: number;
  lastActivityTs: number;
}

const CLOSED_ORDER_STATUSES = new Set(["delivered", "cancelled"]);

/** Drop the computed running-balance fields so a row can be re-summarised after merging. */
function stripRunningBalances(
  r: CustomerLedgerRow,
): Omit<CustomerLedgerRow, "closingGoldMg" | "closingMoneyPaise"> {
  const { closingGoldMg: _g, closingMoneyPaise: _m, ...rest } = r;
  void _g;
  void _m;
  return rest;
}

/**
 * One jeweller's complete book.
 *
 * ponytail: recompiled on demand from the stores rather than cached. A
 * workshop's ledger is thousands of rows, not millions — memoize at the call
 * site (useMemo) and revisit only if a real book gets slow.
 */
export function compileJewellerBook(jewellerId: string): JewellerBook | null {
  const jeweller = usePeople.getState().people.find((p) => p.id === jewellerId);
  if (!jeweller) return null;

  // Base ledger (settlements + orders + invoices), then merged with whatever the
  // Payment module (and any future contributor) has registered for this party —
  // re-summarised so payments and settlements share ONE running balance. With no
  // contributor registered this is exactly the base ledger, so today's numbers
  // are unchanged while the payment data-flow is already wired.
  const base = compileCustomerLedger(jewellerId);
  const contributed = contributedRowsFor(jewellerId);
  const ledger: CustomerLedgerSummary = contributed.length
    ? summariseLedgerRows([
        ...base.rows.map(stripRunningBalances),
        ...contributed.map((c) => ({ ...c })),
      ])
    : base;

  const orders = useOrders
    .getState()
    .orders.filter((o) => o.customerId === jewellerId)
    .sort((a, b) => b.createdAt - a.createdAt);

  const jobCards = useJobCards
    .getState()
    .jobs.filter((j) => j.customerId === jewellerId)
    .sort((a, b) => b.createdAt - a.createdAt);

  const bills = useMfgBills
    .getState()
    .bills.filter((b) => b.customerId === jewellerId)
    .sort((a, b) => b.createdAt - a.createdAt);

  const settlements = useGoldSettlement
    .getState()
    .settlements.filter((s) => s.party_type === "customer" && s.party_id === jewellerId);

  const lastActivityTs = Math.max(
    0,
    ...orders.map((o) => o.createdAt),
    ...bills.map((b) => b.createdAt),
    ...ledger.rows.map((r) => r.ts),
  );

  return {
    jeweller,
    ledger,
    orders,
    jobCards,
    bills,
    settlements,

    goldReceivedMg: ledger.totalGoldInMg,
    goldIssuedMg: ledger.totalGoldOutMg,
    goldHeldMg: ledger.goldAdvanceMg,
    goldOwedMg: ledger.goldCreditOwedMg,

    cashDuePaise: ledger.moneyDuePaise,
    cashAdvancePaise: ledger.moneyAdvancePaise,

    openOrders: orders.filter((o) => !CLOSED_ORDER_STATUSES.has(o.status)).length,
    openJobCards: jobCards.filter((j) => normalizeJobStatus(j.status) !== "closed").length,
    deliveredPieces: bills.filter((b) => b.status === "delivered" || b.status === "settled").length,
    lastActivityTs,
  };
}

/**
 * Every jeweller who has a book worth opening — i.e. has actually transacted.
 * A name in the People registry with no gold, no order and no bill is not a
 * ledger page; it's a contact.
 */
export function compileJewellerBooks(): JewellerBook[] {
  return usePeople
    .getState()
    .people.filter((p) => JEWELLER_TYPES.includes(p.type))
    .map((p) => compileJewellerBook(p.id))
    .filter((b): b is JewellerBook => b !== null)
    .filter((b) => b.ledger.rows.length > 0 || b.orders.length > 0 || b.bills.length > 0)
    .sort((a, b) => b.lastActivityTs - a.lastActivityTs);
}

/** Workshop-wide totals across every jeweller book — the top of the ledger page. */
export function jewellerBooksTotals(books: JewellerBook[]) {
  return books.reduce(
    (acc, b) => ({
      goldHeldMg: acc.goldHeldMg + b.goldHeldMg,
      goldOwedMg: acc.goldOwedMg + b.goldOwedMg,
      cashDuePaise: acc.cashDuePaise + b.cashDuePaise,
      openOrders: acc.openOrders + b.openOrders,
      openJobCards: acc.openJobCards + b.openJobCards,
    }),
    { goldHeldMg: 0, goldOwedMg: 0, cashDuePaise: 0, openOrders: 0, openJobCards: 0 },
  );
}
