/**
 * Workshop — Outside Worker Books (read-only ledger view).
 *
 * Reflects the Outside Work transaction module (/workshop/outside-work) as
 * read-only per-purity books inside Workshop, one book set per outside party.
 * Entry stays in the transaction module; this only reads local state.
 */
import { useOutsideWork, type OutsideWorkTransaction } from "./outside-work-store";
import { usePeople, type Person } from "./people-store";
import { buildPartyPurityBooks, type PartyPurityBook, type PartyTxn } from "./workshop-party-books";

export interface OutsideBook {
  party: Person | { id: string; fullName: string };
  purityBooks: PartyPurityBook[];
  txnCount: number;
  lastActivityTs: number;
}

function toPartyTxn(t: OutsideWorkTransaction): PartyTxn {
  return {
    id: t.id,
    ts: t.ts,
    txnNo: t.txnNo,
    date: new Date(t.ts).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
    particulars: `${t.materialType}${t.remarks ? ` · ${t.remarks}` : ""}`,
    purity: t.purity,
    grossMg: t.grossMg,
    fineMg: t.fineMg,
    direction: t.type === "issue" ? "out" : "in",
    orderId: t.orderId,
    orderNo: t.orderNo,
  };
}

export function compileOutsideBook(partyId: string): OutsideBook | null {
  const txns = useOutsideWork.getState().transactions.filter((t) => t.jewellerId === partyId);
  if (txns.length === 0 && !usePeople.getState().people.some((p) => p.id === partyId)) return null;
  const person = usePeople.getState().people.find((p) => p.id === partyId);
  const party = person ?? { id: partyId, fullName: txns[0]?.jewellerName ?? "Outside party" };
  return {
    party,
    purityBooks: buildPartyPurityBooks(txns.map(toPartyTxn)),
    txnCount: txns.length,
    lastActivityTs: txns.reduce((m, t) => Math.max(m, t.ts), 0),
  };
}

export function compileOutsideBooks(): OutsideBook[] {
  const txns = useOutsideWork.getState().transactions;
  const ids = new Map<string, string>();
  for (const t of txns) ids.set(t.jewellerId, t.jewellerName);
  return Array.from(ids.keys())
    .map((id) => compileOutsideBook(id))
    .filter((b): b is OutsideBook => b !== null)
    .sort((a, b) => b.lastActivityTs - a.lastActivityTs);
}
