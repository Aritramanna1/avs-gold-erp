/**
 * Authoritative party opening balances from `party_opening_balances` (migration batches).
 * Merged into customer ledger compilation; people.data opening fields are fallback only.
 */
import { dataProvider as supabase } from "@/lib/providers/data-provider";

export interface PartyOpeningBalanceRow {
  id: string;
  partyId: string;
  asOfDate: string;
  cashDebitPaise: number;
  cashCreditPaise: number;
  fineGoldDebitMg: number;
  fineGoldCreditMg: number;
  notes?: string;
}

let byPartyId = new Map<string, PartyOpeningBalanceRow[]>();
let hydrated = false;

function mapRow(row: Record<string, unknown>): PartyOpeningBalanceRow {
  return {
    id: String(row.id),
    partyId: String(row.party_id),
    asOfDate: String(row.as_of_date),
    cashDebitPaise: Number(row.cash_debit_paise ?? 0),
    cashCreditPaise: Number(row.cash_credit_paise ?? 0),
    fineGoldDebitMg: Number(row.fine_gold_debit_mg ?? 0),
    fineGoldCreditMg: Number(row.fine_gold_credit_mg ?? 0),
    notes: row.notes ? String(row.notes) : undefined,
  };
}

export async function hydratePartyOpeningBalances(): Promise<void> {
  const { data, error } = await supabase.from("party_opening_balances").select("*");
  if (error) {
    console.warn("[party-opening-balances] hydrate failed:", error.message);
    hydrated = true;
    return;
  }
  const next = new Map<string, PartyOpeningBalanceRow[]>();
  for (const raw of data ?? []) {
    const row = mapRow(raw as Record<string, unknown>);
    const list = next.get(row.partyId) ?? [];
    list.push(row);
    next.set(row.partyId, list);
  }
  byPartyId = next;
  hydrated = true;
}

export function getPartyOpeningBalanceRows(partyId: string): PartyOpeningBalanceRow[] {
  if (!hydrated) {
    void hydratePartyOpeningBalances();
  }
  return byPartyId.get(partyId) ?? [];
}

export function hasAuthoritativePartyOpeningBalances(partyId: string): boolean {
  return getPartyOpeningBalanceRows(partyId).length > 0;
}

async function resolveFirmId(): Promise<string | null> {
  const { data } = await supabase
    .from("user_profiles" as never)
    .select("firm_id")
    .maybeSingle();
  return (data as { firm_id?: string } | null)?.firm_id ?? null;
}

/** Canonical write path for assistant / people onboarding opening gold credits. */
export async function insertPartyOpeningGoldCredit(input: {
  partyId: string;
  fineGoldCreditMg: number;
  asOfDate?: string;
  notes?: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (input.fineGoldCreditMg <= 0) {
    return { ok: false, error: "Opening gold credit must be positive." };
  }

  const firmId = await resolveFirmId();
  if (!firmId) {
    return { ok: false, error: "Firm context is not available for opening balance posting." };
  }

  const { error } = await supabase.from("party_opening_balances").insert({
    firm_id: firmId,
    party_id: input.partyId,
    as_of_date: input.asOfDate ?? new Date().toISOString().split("T")[0],
    fine_gold_credit_mg: input.fineGoldCreditMg,
    notes: input.notes ?? "Opening gold balance",
  });

  if (error) return { ok: false, error: error.message };

  await hydratePartyOpeningBalances();
  return { ok: true };
}
