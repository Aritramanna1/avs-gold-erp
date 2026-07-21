/**
 * Workshop — Polishing Books (read-only ledger view).
 *
 * Reflects the Polishing transaction module (/workshop/polishing) as read-only
 * per-purity books inside Workshop, one book set per polisher. Entry stays in
 * the transaction module; this only reads local state.
 */
import { usePolishing, type PolishingTransaction } from "./polishing-store";
import { usePeople, type Person } from "./people-store";
import { buildPartyPurityBooks, type PartyPurityBook, type PartyTxn } from "./workshop-party-books";

export interface PolishingBook {
  party: Person | { id: string; fullName: string };
  purityBooks: PartyPurityBook[];
  txnCount: number;
  lastActivityTs: number;
}

function toPartyTxn(t: PolishingTransaction): PartyTxn {
  return {
    id: t.id,
    ts: t.ts,
    txnNo: t.txnNo,
    date: new Date(t.ts).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
    particulars: `${t.product}${t.remarks ? ` · ${t.remarks}` : ""}`,
    purity: t.purity,
    grossMg: t.grossMg,
    fineMg: t.fineMg,
    direction: t.type === "sent" ? "out" : "in",
    orderId: t.orderId,
    orderNo: t.orderNo,
  };
}

export function compilePolishingBook(partyId: string): PolishingBook | null {
  const txns = usePolishing.getState().transactions.filter((t) => t.polisherId === partyId);
  if (txns.length === 0 && !usePeople.getState().people.some((p) => p.id === partyId)) return null;
  const person = usePeople.getState().people.find((p) => p.id === partyId);
  const party = person ?? { id: partyId, fullName: txns[0]?.polisherName ?? "Polisher" };
  return {
    party,
    purityBooks: buildPartyPurityBooks(txns.map(toPartyTxn)),
    txnCount: txns.length,
    lastActivityTs: txns.reduce((m, t) => Math.max(m, t.ts), 0),
  };
}

export function compilePolishingBooks(): PolishingBook[] {
  const txns = usePolishing.getState().transactions;
  const ids = new Map<string, string>();
  for (const t of txns) ids.set(t.polisherId, t.polisherName);
  return Array.from(ids.keys())
    .map((id) => compilePolishingBook(id))
    .filter((b): b is PolishingBook => b !== null)
    .sort((a, b) => b.lastActivityTs - a.lastActivityTs);
}
