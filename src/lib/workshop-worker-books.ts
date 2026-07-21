/**
 * Workshop — Worker Books (read-only ledger view).
 *
 * The Worker Gold Book at /workshop/gold-book stays the TRANSACTION module —
 * that is where issues and returns are entered. This compiler produces the
 * READ-ONLY ledger/profile that appears inside Workshop's book hub, exactly the
 * way Jeweller Books do: Workshop is the master ledger and reporting hub, it
 * never enters transactions.
 *
 * SEPARATE BOOK PER PURITY. A worker who works in 22K, 18K and Fine has THREE
 * independent books, each its own complete running ledger — exactly like the
 * physical worker books. Purities are never mixed and never converted: 916
 * stays 916. This reads only local zustand state (offline-first) — never
 * Supabase.
 */
import { useWorkerGoldBook, type WorkerGoldBookEntry } from "./worker-gold-book-store";
import { usePeople, type Person, type PersonType } from "./people-store";
import { getCaratLabel } from "./gold";

/** Person types that keep a worker book (bench workers, not jewellers/vendors). */
export const WORKER_BOOK_TYPES: PersonType[] = ["karigar", "worker", "outside_worker", "employee"];

/** One row of a purity book's running ledger. */
export interface WorkerBookRow {
  entry: WorkerGoldBookEntry;
  /** Fine gold issued TO the worker on this row (0 for a return). */
  issuedFineMg: number;
  /** Fine gold / jewellery RETURNED by the worker on this row (0 for an issue). */
  returnedFineMg: number;
  /** "Less" deducted on weighing this row — the wastage figure. */
  wastageMg: number;
  /** Balance BEFORE this row (previous balance). */
  previousBalanceMg: number;
  /** Balance AFTER this row (current balance) = issued − returned, cumulative. */
  runningBalanceMg: number;
}

/**
 * One purity's complete, independent book for a worker. Never shares a balance
 * with another purity.
 */
export interface WorkerPurityBook {
  purity: number;
  label: string;
  rows: WorkerBookRow[];
  issuedFineMg: number;
  returnedFineMg: number;
  wastageMg: number;
  /** Difference = issued − returned = the gold still with the worker in THIS purity. */
  currentBalanceMg: number;
  /** Distinct linked orders touched by this purity book. */
  linkedOrders: { orderId: string; orderNo: string }[];
  lastActivityTs: number;
}

export interface WorkerBook {
  worker: Person;
  /** One independent running ledger per purity. */
  purityBooks: WorkerPurityBook[];
  entryCount: number;
  lastActivityTs: number;
}

/** One worker's read-only book set — one running ledger per purity. */
export function compileWorkerBook(workerId: string): WorkerBook | null {
  const worker = usePeople.getState().people.find((p) => p.id === workerId);
  if (!worker) return null;

  const entries = useWorkerGoldBook.getState().entries.filter((e) => e.workerId === workerId);

  // Group by purity — each group is its own book. Non-gold materials (purity 0)
  // fall into their own "unspecified" book so they never mix with gold.
  const byPurity = new Map<number, WorkerGoldBookEntry[]>();
  for (const e of entries) {
    const key = e.purity && e.purity > 0 ? e.purity : 0;
    const list = byPurity.get(key) ?? [];
    list.push(e);
    byPurity.set(key, list);
  }

  const purityBooks: WorkerPurityBook[] = [];
  for (const [purity, list] of byPurity) {
    // Oldest first so the running balance builds the way the physical book reads.
    const chrono = [...list].sort((a, b) => a.createdAt - b.createdAt);
    let running = 0;
    let issued = 0;
    let returned = 0;
    let wastage = 0;
    const orders = new Map<string, string>();

    const rows: WorkerBookRow[] = chrono.map((entry) => {
      const issuedFineMg = entry.type === "given" ? entry.fineMg : 0;
      const returnedFineMg = entry.type === "return" ? entry.fineMg : 0;
      const wastageMg = entry.lessMg || 0;
      const previousBalanceMg = running;
      running += issuedFineMg - returnedFineMg;
      issued += issuedFineMg;
      returned += returnedFineMg;
      wastage += wastageMg;
      if (entry.orderId) orders.set(entry.orderId, entry.orderNo || entry.orderId);
      return {
        entry,
        issuedFineMg,
        returnedFineMg,
        wastageMg,
        previousBalanceMg,
        runningBalanceMg: running,
      };
    });

    purityBooks.push({
      purity,
      label: purity > 0 ? getCaratLabel(purity) : "Non-gold / Unspecified",
      // Display newest first.
      rows: rows.reverse(),
      issuedFineMg: issued,
      returnedFineMg: returned,
      wastageMg: wastage,
      currentBalanceMg: running,
      linkedOrders: Array.from(orders, ([orderId, orderNo]) => ({ orderId, orderNo })),
      lastActivityTs: chrono.length ? chrono[chrono.length - 1].createdAt : 0,
    });
  }

  // Highest purity first; unspecified sinks to the bottom.
  purityBooks.sort((a, b) => b.purity - a.purity);

  return {
    worker,
    purityBooks,
    entryCount: entries.length,
    lastActivityTs: entries.length ? Math.max(...entries.map((e) => e.createdAt)) : 0,
  };
}

/** A worker's payable gold, per purity — the seam the Payment module reads. */
export interface WorkerPayableBalance {
  purity: number;
  label: string;
  /** Gold still with the worker in this purity = the current payable/receivable. Positive = worker holds our gold. */
  payableFineMg: number;
}

/**
 * The Worker Book's ONE calculation: current payable gold balance, per purity.
 *
 * Deliberately NOT here: salary, advances, wastage/chain deductions, or final
 * settlement — those are the Payment module's job and are driven by
 * configurable Settings rules, never hardcoded in the book. The Payment module
 * calls this to read the raw per-purity balances and applies its own rules on
 * top, so it plugs in without another Workshop redesign.
 */
export function getWorkerPayableBalances(workerId: string): WorkerPayableBalance[] {
  const book = compileWorkerBook(workerId);
  if (!book) return [];
  return book.purityBooks.map((pb) => ({
    purity: pb.purity,
    label: pb.label,
    payableFineMg: pb.currentBalanceMg,
  }));
}

/** Every worker who has a book worth opening — i.e. has at least one entry. */
export function compileWorkerBooks(): WorkerBook[] {
  const entries = useWorkerGoldBook.getState().entries;
  const workerIds = new Set(entries.map((e) => e.workerId));
  return usePeople
    .getState()
    .people.filter((p) => WORKER_BOOK_TYPES.includes(p.type) && workerIds.has(p.id))
    .map((p) => compileWorkerBook(p.id))
    .filter((b): b is WorkerBook => b !== null)
    .sort((a, b) => b.lastActivityTs - a.lastActivityTs);
}
