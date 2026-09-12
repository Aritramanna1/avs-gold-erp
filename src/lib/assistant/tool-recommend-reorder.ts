/**
 * AVS-69 — recommend_reorder RECOMMEND tool (suggest only).
 * Reads existing tip stock/gold data via useStock. Never auto-writes ledger/stock.
 * Empty/partial OK when data is thin — does not invent quantities.
 *
 * Low-stock threshold: reuses tip automation rule_low_stock_alert condition
 * (payload.quantity less_than 3) — not a new invented schema.
 */

import { useStock, type StockItem } from "@/lib/stock-store";
import { mgToGrams } from "@/lib/gold";
import type { ERPActionCard } from "./assistant-types";
import { auditAssistantAction } from "./assistant-tool-registry";

/** Tip rule_low_stock_alert: quantity less_than 3 */
export const TIP_LOW_STOCK_THRESHOLD = 3;

export type ReorderSuggestion = {
  category: string;
  purityPerMille: number | null;
  availablePieces: number;
  availableGrossGrams: string | null;
  /** Observed only — never invented target qty */
  tipLowStockThreshold: number;
  belowTipThreshold: boolean;
  sampleItemCodes: string[];
};

export type RecommendReorderResult = {
  ok: true;
  action: "recommend_reorder";
  suggestOnly: true;
  suggestions: ReorderSuggestion[];
  scannedAvailableItems: number;
  note: string;
};

export function looksLikeRecommendReorderIntent(q: string): boolean {
  const s = q.toLowerCase();
  if (s.includes("recommend reorder") || s.includes("reorder recommend")) return true;
  if (s.includes("suggest reorder") || s.includes("reorder suggestion")) return true;
  if (s.includes("what to reorder") || s.includes("what should i reorder")) return true;
  if (s.includes("low stock") && (s.includes("recommend") || s.includes("suggest") || s.includes("reorder")))
    return true;
  if (s.includes("stock reorder") || s.includes("reorder stock")) return true;
  if (s.includes("fast moving") && s.includes("reorder")) return true;
  return false;
}

function isAvailable(item: StockItem): boolean {
  const st = String(item.status || "").toLowerCase();
  return st === "available" || st === "in_stock" || st === "";
}

/**
 * Aggregate available tip stock by category + purity. Suggest-only; no writes.
 */
export function computeReorderSuggestions(opts?: {
  category?: string | null;
  /** Override only when caller passes explicit tip-aligned threshold; default tip rule = 3 */
  lowStockThreshold?: number;
}): RecommendReorderResult {
  const threshold =
    typeof opts?.lowStockThreshold === "number" && opts.lowStockThreshold > 0
      ? opts.lowStockThreshold
      : TIP_LOW_STOCK_THRESHOLD;

  const items = useStock.getState().items || [];
  const available = items.filter(isAvailable);
  const filtered = opts?.category
    ? available.filter(
        (i) => (i.category || "").toLowerCase() === String(opts.category).toLowerCase(),
      )
    : available;

  type Agg = {
    category: string;
    purityPerMille: number | null;
    pieces: number;
    grossMg: number;
    codes: string[];
  };
  const map = new Map<string, Agg>();

  for (const item of filtered) {
    const category = (item.category || "").trim() || "Uncategorized";
    const purity = typeof item.purity === "number" ? item.purity : null;
    const key = `${category}::${purity ?? "na"}`;
    const pieces = typeof item.piecesCount === "number" && item.piecesCount > 0 ? item.piecesCount : 1;
    const prev = map.get(key) || {
      category,
      purityPerMille: purity,
      pieces: 0,
      grossMg: 0,
      codes: [],
    };
    prev.pieces += pieces;
    prev.grossMg += typeof item.grossMg === "number" ? item.grossMg : 0;
    if (prev.codes.length < 5 && item.itemCode) prev.codes.push(item.itemCode);
    map.set(key, prev);
  }

  const suggestions: ReorderSuggestion[] = Array.from(map.values())
    .map((a) => ({
      category: a.category,
      purityPerMille: a.purityPerMille,
      availablePieces: a.pieces,
      availableGrossGrams: a.grossMg > 0 ? mgToGrams(a.grossMg) : null,
      tipLowStockThreshold: threshold,
      belowTipThreshold: a.pieces < threshold,
      sampleItemCodes: a.codes,
    }))
    .filter((s) => s.belowTipThreshold)
    .sort((a, b) => a.availablePieces - b.availablePieces);

  let note: string;
  if (filtered.length === 0) {
    note =
      "No available stock rows in tip store — empty suggestion list (not invented). Confirm opens Stock for human review; no ledger/stock write.";
  } else if (suggestions.length === 0) {
    note = `Scanned ${filtered.length} available item(s); none below tip low-stock threshold (${threshold}). Suggest-only — no auto reorder write.`;
  } else {
    note = `Suggest-only from tip stock. Threshold from tip rule_low_stock_alert (quantity < ${threshold}). No reorder quantities invented; human accept required — never auto-writes stock/ledger.`;
  }

  return {
    ok: true,
    action: "recommend_reorder",
    suggestOnly: true,
    suggestions,
    scannedAvailableItems: filtered.length,
    note,
  };
}

export async function toolRecommendReorder(userMessage: string): Promise<ERPActionCard> {
  const result = computeReorderSuggestions();

  await auditAssistantAction({
    actionKey: "recommend_reorder",
    actionType: "suggest",
    status: "requested",
    requiresConfirmation: true,
    requestPayload: { phrase: userMessage },
    resultPayload: {
      count: result.suggestions.length,
      scannedAvailableItems: result.scannedAvailableItems,
    },
  });

  const rows = result.suggestions.map((s) => ({
    category: s.category,
    purity: s.purityPerMille != null ? String(s.purityPerMille) : "—",
    availablePieces: s.availablePieces,
    availableGrossGrams: s.availableGrossGrams != null ? String(s.availableGrossGrams) : "—",
    tipThreshold: s.tipLowStockThreshold,
    samples: s.sampleItemCodes.join(", ") || "—",
  }));

  return {
    type: "action_confirmation",
    title:
      result.suggestions.length > 0
        ? `Reorder suggestions (${result.suggestions.length})`
        : "Reorder suggestions (none)",
    summary: result.note,
    actionRoute: "/stock",
    actionPayload: {
      actionId: `act_reorder_${Date.now()}`,
      actionType: "recommend_reorder",
      title: "Accept reorder suggestions (no stock write)",
      description:
        "Human acknowledgement only. Accepting does NOT create stock, transfers, jobs, or ledger entries. Open Stock to act manually.",
      requiresConfirmation: true,
      targetType: "inventory",
      details: {
        suggestOnly: true,
        neverAutoWrite: true,
        suggestions: result.suggestions,
      },
    },
    kpis: [
      { label: "Suggestions", value: String(result.suggestions.length) },
      { label: "Scanned available", value: String(result.scannedAvailableItems) },
      { label: "Tip threshold", value: `< ${TIP_LOW_STOCK_THRESHOLD} pcs` },
      { label: "Writes", value: "None (suggest-only)", variant: "default" },
    ],
    tableColumns: [
      { key: "category", header: "Category" },
      { key: "purity", header: "Purity" },
      { key: "availablePieces", header: "Available pcs" },
      { key: "availableGrossGrams", header: "Gross g" },
      { key: "tipThreshold", header: "Tip <N" },
      { key: "samples", header: "Sample codes" },
    ],
    tableRows: rows,
    data: result,
  };
}
