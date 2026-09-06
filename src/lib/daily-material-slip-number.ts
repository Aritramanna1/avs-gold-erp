/**
 * Daily Material Slip — pure number helpers (no store imports).
 *
 * Kept dependency-free so the format is unit-checkable in isolation and can be
 * imported anywhere (renderer, print route, reports) without dragging in the
 * Worker Gold Book store. See daily-material-slip.ts for the slip compilers.
 */
export type SlipMaterial = "gold"; // future: "silver" | "platinum" | "diamond" | "gemstone" | "consumable"

/** Slip-number prefix per material. MTS = Material Transaction Slip (gold today). */
export const MATERIAL_PREFIX: Record<SlipMaterial, string> = { gold: "MTS" };

/**
 * Build the Daily Slip Number for a date. Per worker per day: since exactly one
 * slip exists for a worker on a date, the sequence is 001. `seq` is exposed only
 * for a rare same-day reissue.
 * ponytail: seq fixed at 1 by callers; bump it if multi-slip-per-day is ever needed.
 */
export function dailySlipNumber(date?: string | null, seq = 1, material: SlipMaterial = "gold"): string {
  const safeDate = typeof date === "string" ? date.replace(/-/g, "") : "00000000";
  const prefix = MATERIAL_PREFIX[material] || "MTS";
  return `${prefix}-${safeDate}-${String(seq).padStart(3, "0")}`;
}

/** The slip number an individual ledger entry belongs to. Use anywhere an entry is shown. */
export function slipNumberForEntry(entry?: { date?: string | null } | null): string {
  return dailySlipNumber(entry?.date);
}

