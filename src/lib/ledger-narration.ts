/**
 * Canonical narration helpers — store once in ledger metadata; reports/print read it.
 */
export type NarrationParts = {
  module: string;
  action: string;
  party?: string;
  reference?: string;
  detail?: string;
};

export function formatNarration(parts: NarrationParts): string {
  const chunks = [
    parts.action,
    parts.party,
    parts.reference ? `Ref ${parts.reference}` : null,
    parts.detail,
  ].filter(Boolean);
  return chunks.join(" · ").trim();
}

export function resolveNarrationForDisplay(input: {
  narration?: string | null;
  notes?: string | null;
  description?: string | null;
  reference?: string | null;
  counterpartyName?: string | null;
  fallback?: string;
}): string {
  const n = input.narration?.trim();
  if (n) return n;
  const notes = input.notes?.trim();
  if (notes) return notes;
  const ref = input.reference?.trim();
  if (ref) return ref;
  const desc = input.description?.trim();
  if (desc) return desc;
  return input.counterpartyName?.trim() || input.fallback || "—";
}

/** Human label for metadata.source module ids. */
export function formatLedgerSourceLabel(source: string | undefined | null): string {
  if (!source) return "—";
  const map: Record<string, string> = {
    treasury_voucher: "Treasury",
    billing_payment: "Billing",
    party_ledger_cash_gold: "Party ledger",
    gold_settlement_cash: "Gold settlement",
    expense: "Expenses",
    treasury_journal: "Journal",
    treasury_contra: "Contra",
  };
  return map[source] ?? source.replace(/_/g, " ");
}
