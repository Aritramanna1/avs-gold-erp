/**
 * Workshop — generic per-purity party book engine.
 *
 * Worker, Outside Worker and Polishing books all share the same physical-book
 * shape: gold goes OUT to a party in a given purity, comes back IN, and each
 * purity keeps its own independent running balance (never mixed, never
 * converted). This module holds that logic ONCE so the three book kinds are
 * thin adapters over it, not three copies.
 *
 * Read-only adapters compile rows from the active Supabase-backed stores.
 * Balances are "current payable gold" per purity; salary, wastage, and
 * deduction rules belong to the configurable Payment module.
 */
import { getCaratLabel } from "./gold";

/** A normalized transaction any book kind maps its store rows into. */
export interface PartyTxn {
  id: string;
  ts: number;
  txnNo: string;
  date: string;
  particulars: string;
  purity: number;
  grossMg: number;
  fineMg: number;
  /** "out" = gold issued/sent to the party; "in" = returned/received back. */
  direction: "out" | "in";
  orderId?: string;
  orderNo?: string;
}

export interface PartyBookRow {
  txn: PartyTxn;
  issuedFineMg: number;
  returnedFineMg: number;
  previousBalanceMg: number;
  runningBalanceMg: number;
}

export interface PartyPurityBook {
  purity: number;
  label: string;
  rows: PartyBookRow[];
  issuedFineMg: number;
  returnedFineMg: number;
  /** Gold still with the party in THIS purity = current payable. */
  currentBalanceMg: number;
  linkedOrders: { orderId: string; orderNo: string }[];
  lastActivityTs: number;
}

/** Split normalized txns into one independent running book per purity. */
export function buildPartyPurityBooks(txns: PartyTxn[]): PartyPurityBook[] {
  const byPurity = new Map<number, PartyTxn[]>();
  for (const t of txns) {
    const key = t.purity && t.purity > 0 ? t.purity : 0;
    const list = byPurity.get(key) ?? [];
    list.push(t);
    byPurity.set(key, list);
  }

  const books: PartyPurityBook[] = [];
  for (const [purity, list] of byPurity) {
    const chrono = [...list].sort((a, b) => a.ts - b.ts);
    let running = 0;
    let issued = 0;
    let returned = 0;
    const orders = new Map<string, string>();

    const rows: PartyBookRow[] = chrono.map((txn) => {
      const issuedFineMg = txn.direction === "out" ? txn.fineMg : 0;
      const returnedFineMg = txn.direction === "in" ? txn.fineMg : 0;
      const previousBalanceMg = running;
      running += issuedFineMg - returnedFineMg;
      issued += issuedFineMg;
      returned += returnedFineMg;
      if (txn.orderId) orders.set(txn.orderId, txn.orderNo || txn.orderId);
      return { txn, issuedFineMg, returnedFineMg, previousBalanceMg, runningBalanceMg: running };
    });

    books.push({
      purity,
      label: purity > 0 ? getCaratLabel(purity) : "Non-gold / Unspecified",
      rows: rows.reverse(), // newest first for display
      issuedFineMg: issued,
      returnedFineMg: returned,
      currentBalanceMg: running,
      linkedOrders: Array.from(orders, ([orderId, orderNo]) => ({ orderId, orderNo })),
      lastActivityTs: chrono.length ? chrono[chrono.length - 1].ts : 0,
    });
  }

  return books.sort((a, b) => b.purity - a.purity);
}
