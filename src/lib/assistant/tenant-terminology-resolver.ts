/**
 * Resolves tenant-configured terminology (42 canonical terms + custom overrides)
 * into canonical intent tokens for the Assistant normalization pipeline.
 */
import {
  CANONICAL_42_TERMS,
  useTerminology,
  type TerminologyPackId,
} from "@/lib/terminology-engine-store";

const CANONICAL_KEY_PHRASES: Record<string, string> = {
  metal_rate: "metal rate",
  worker_artisan: "karigar",
  party_customer: "customer",
  party_supplier: "supplier",
  metal_receipt: "metal receipt",
  metal_issue: "metal issue",
  wastage_loss: "wastage",
  fine_weight: "fine weight",
  gross_weight: "gross weight",
  net_weight: "net weight",
  touch_purity: "touch purity",
  gold_book: "gold book",
  party_ledger: "party ledger",
  opening_balance: "opening balance",
  old_gold_exchange: "old gold",
  hallmark_huid: "hallmark huid",
  melting_refining: "melting refining",
  gold_settlement: "gold settlement",
  delivery_challan: "delivery challan",
  job_card: "job card",
};

function packLabelKey(pack: TerminologyPackId): keyof (typeof CANONICAL_42_TERMS)[0] {
  switch (pack) {
    case "standard_business":
      return "standardBusiness";
    case "international_formal":
      return "internationalFormal";
    case "manufacturer_default":
      return "manufacturerDefault";
    case "wholesaler_default":
      return "wholesalerDefault";
    case "retail_default":
      return "retailDefault";
    default:
      return "indianTrade";
  }
}

/** Build alias map: tenant display labels → canonical phrases */
export function buildTenantTerminologyAliasMap(): Record<string, string> {
  const { activePack, customOverrides } = useTerminology.getState();
  const labelKey = packLabelKey(activePack);
  const map: Record<string, string> = {};

  for (const term of CANONICAL_42_TERMS) {
    const canonicalPhrase = CANONICAL_KEY_PHRASES[term.key] ?? term.key.replace(/_/g, " ");
    const display =
      customOverrides[term.key]?.trim() || String(term[labelKey] ?? term.indianTrade).trim();

    if (!display) continue;

    const normalizedDisplay = display.toLowerCase();
    map[normalizedDisplay] = canonicalPhrase;

    // Also map slash-separated variants (e.g. "Party / Grahak" → "party", "grahak")
    for (const part of display.split(/\s*\/\s*/)) {
      const p = part.trim().toLowerCase();
      if (p.length >= 2) map[p] = canonicalPhrase;
    }
  }

  return map;
}

/** Apply tenant terminology resolution after typo normalization */
export function resolveTenantTerminology(text: string): string {
  const aliasMap = buildTenantTerminologyAliasMap();
  let result = text;

  // Longest phrases first to avoid partial replacements
  const entries = Object.entries(aliasMap).sort((a, b) => b[0].length - a[0].length);
  for (const [display, canonical] of entries) {
    if (display.length < 3) continue;
    const escaped = display.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`\\b${escaped}\\b`, "gi");
    result = result.replace(re, canonical);
  }

  return result;
}
