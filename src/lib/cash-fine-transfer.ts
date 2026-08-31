/**
 * Offline Cash↔Fine transfer (types 21/22) — posts money voucher + gold_ledger.
 * Rate is frozen in notes/reference. No second SoT.
 */
import { postMoneyVoucher } from "@/lib/money-voucher";
import { useLedger } from "@/lib/ledger-store";

export type CashFineDirection = "cash_to_fine" | "fine_to_cash";

export async function postCashFineTransfer(input: {
  partyId: string;
  direction: CashFineDirection;
  /** Fine gold milligrams exchanged */
  fineMg: number;
  /** Rate in paise per gram */
  ratePerGramPaise: number;
  narration?: string;
}): Promise<{ ok: true; sourceId: string } | { ok: false; error: string }> {
  if (!input.partyId) return { ok: false, error: "Party required" };
  if (input.fineMg <= 0) return { ok: false, error: "Fine weight must be positive" };
  if (input.ratePerGramPaise <= 0) return { ok: false, error: "Rate required" };

  const amountPaise = Math.round((input.fineMg / 1000) * input.ratePerGramPaise);
  if (amountPaise <= 0) return { ok: false, error: "Amount computes to zero" };

  const sourceId = `c2f-${crypto.randomUUID()}`;
  const cashToFine = input.direction === "cash_to_fine";
  const narration =
    input.narration ||
    (cashToFine
      ? `Cash→Fine ${input.fineMg}mg @ ₹${(input.ratePerGramPaise / 100).toFixed(2)}/g = ₹${(amountPaise / 100).toFixed(2)}`
      : `Fine→Cash ${input.fineMg}mg @ ₹${(input.ratePerGramPaise / 100).toFixed(2)}/g = ₹${(amountPaise / 100).toFixed(2)}`);

  const money = await postMoneyVoucher({
    kind: cashToFine ? "payment" : "receipt",
    partyId: input.partyId,
    amountPaise,
    method: "cash",
    narration,
    source: "cash_fine_transfer",
    sourceId,
  });
  if (!money.posted && !money.alreadyPosted) {
    return { ok: false, error: money.error || "Money voucher failed" };
  }

  const signed = cashToFine ? input.fineMg : -input.fineMg;
  try {
    await useLedger.getState().append({
      type: "adjustment",
      netFineMg: 0,
      deltas: { customer: signed, vault: -signed },
      fineMg: input.fineMg,
      purity: 999,
      notes: narration,
      reference: sourceId,
      source: "cash_fine_transfer",
      sourceId,
      customerId: input.partyId,
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gold ledger post failed" };
  }

  return { ok: true, sourceId };
}
