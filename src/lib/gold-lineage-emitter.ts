/**
 * Canonical gold lineage event emitter — workshop, billing, settlement lifecycle.
 */
import { dataProvider as supabase } from "@/lib/providers/data-provider";

export type GoldLineageEventType =
  "deposit" | "conversion" | "issue" | "return" | "sale" | "settlement" | "billing";

export async function emitGoldLineageEvent(input: {
  eventType: GoldLineageEventType;
  voucherRef: string;
  grossWeightMg?: number;
  fineGoldMg?: number;
  touchPurity?: number;
  fromLocation: string;
  toLocation: string;
  partyName?: string;
  targetLotNumber?: string;
  operatorName?: string;
  notes?: string;
}): Promise<void> {
  const { error } = await supabase.from("gold_lineage_events" as never).insert({
    event_type: input.eventType,
    voucher_ref: input.voucherRef,
    gross_weight_mg: input.grossWeightMg ?? null,
    fine_gold_mg: input.fineGoldMg ?? null,
    touch_purity: input.touchPurity ?? null,
    from_location: input.fromLocation,
    to_location: input.toLocation,
    party_name: input.partyName ?? null,
    target_lot_number: input.targetLotNumber ?? null,
    operator_name: input.operatorName ?? "System",
    notes: input.notes ?? null,
  } as never);

  if (error) {
    console.warn("[gold-lineage] emit failed:", error.message);
  }
}
