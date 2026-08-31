import { create } from "zustand";
import { useSettings } from "./settings-store";
import { reportUnexpectedError } from "./error-handling";
import {
  GoldSettlementRecord,
  createGoldSettlement as apiCreateGoldSettlement,
  listGoldSettlements,
} from "./supabase-services";

interface GoldSettlementState {
  settlements: GoldSettlementRecord[];
  refresh: () => Promise<void>;
  addSettlement: (
    s: Omit<GoldSettlementRecord, "id" | "settlement_date"> & {
      id?: string;
      settlement_date?: string;
    },
  ) => Promise<GoldSettlementRecord>;
  reset: () => void;
}

function makeId(prefix = "gset"): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// Guards a rapid double-click/double-submit from writing two identical gold
// settlement records for the same party before React's disabled state
// commits — same class of race fixed in manufacturing-barcode-store.ts's
// generate().
const addInFlight = new Set<string>();

export const useGoldSettlement = create<GoldSettlementState>()((set, get) => ({
  settlements: [],
  refresh: async () => {
    try {
      const branchId = useSettings.getState().selectedBranchId;
      const rows = await listGoldSettlements(branchId);
      set({ settlements: rows });
    } catch (err) {
      // Leave existing state (don't blank the screen), but this must not
      // vanish silently — a gold settlement view showing stale numbers with
      // no signal is exactly the kind of "did my software eat my money"
      // failure a workshop owner can't afford.
      reportUnexpectedError(err, "gold-settlement.refresh");
    }
  },
  addSettlement: async (input) => {
    const inFlightKey = `${input.party_type}:${input.party_id}:${input.settlement_type}`;
    if (!input.id && addInFlight.has(inFlightKey)) {
      throw new Error("A settlement for this party is already being saved.");
    }
    if (!input.id) addInFlight.add(inFlightKey);
    try {
      return await addSettlementInternal(input);
    } finally {
      addInFlight.delete(inFlightKey);
    }
  },
  reset: () => set({ settlements: [] }),
}));

async function addSettlementInternal(
  input: Omit<GoldSettlementRecord, "id" | "settlement_date"> & {
    id?: string;
    settlement_date?: string;
  },
): Promise<GoldSettlementRecord> {
  const id = input.id ?? makeId();
  const settlement_date = input.settlement_date ?? new Date().toISOString();
  const record: GoldSettlementRecord = {
    id,
    settlement_date,
    party_type: input.party_type,
    party_id: input.party_id,
    branch_id: input.branch_id,
    settlement_type: input.settlement_type,
    purity: input.purity,
    gross_mg: input.gross_mg,
    net_mg: input.net_mg,
    wastage_mg: input.wastage_mg,
    rate_per_gram_paise: input.rate_per_gram_paise,
    amount_paise: input.amount_paise,
    payment_mode: input.payment_mode,
    notes: input.notes,
    attachment_url: input.attachment_url,
    items: input.items,
    p_balance_gold_mg: input.p_balance_gold_mg,
    p_balance_cash_paise: input.p_balance_cash_paise,
    p_balance_ref_voucher_id: input.p_balance_ref_voucher_id,
    p_balance_ref_voucher_date: input.p_balance_ref_voucher_date,
    cash_entry_paise: input.cash_entry_paise,
    gold_entry_mg: input.gold_entry_mg,
    direction: input.direction,
    link_use: input.link_use,
  };

  // Database First: write to Supabase before updating local state
  const saved = await apiCreateGoldSettlement(record);
  if (!saved) throw new Error("Failed to save gold settlement to database — check connection");

  useGoldSettlement.setState({ settlements: [saved, ...useGoldSettlement.getState().settlements] });
  return saved;
}
