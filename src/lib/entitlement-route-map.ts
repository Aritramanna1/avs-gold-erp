/**
 * Canonical route → entitlement feature key map.
 * Used by nav filtering and deep-link deny. Missing path = always allowed (core ERP chrome).
 * Feature keys match module-store / plan_features namespace.
 */
import type { ERPModuleKey } from "@/lib/module-store";

export type EntitlementFeatureKey = ERPModuleKey | "karigar_portal" | "export" | "edition.mtg";

/** Longest-prefix match: first matching prefix wins. */
const ROUTE_FEATURE_PREFIXES: Array<{ prefix: string; feature: EntitlementFeatureKey }> = [
  { prefix: "/billing", feature: "billing" },
  { prefix: "/manufacturing", feature: "manufacturing" },
  { prefix: "/workshop", feature: "manufacturing" },
  { prefix: "/orders", feature: "orders" },
  { prefix: "/stock", feature: "inventory" },
  { prefix: "/catalog", feature: "catalog" },
  { prefix: "/barcode", feature: "barcode" },
  { prefix: "/ledger", feature: "bullion" },
  { prefix: "/conversion", feature: "melt_account" },
  { prefix: "/melt", feature: "melt_account" },
  { prefix: "/refinery", feature: "melt_account" },
  { prefix: "/repair", feature: "repairs" },
  { prefix: "/communications", feature: "crm_communications" },
  { prefix: "/whatsapp", feature: "whatsapp" },
  { prefix: "/attendance", feature: "attendance" },
  { prefix: "/reports", feature: "reports" },
  { prefix: "/branches", feature: "multi_branch" },
  { prefix: "/customer-portal", feature: "customer_portal" },
  { prefix: "/supplier-portal", feature: "supplier_management" },
  { prefix: "/karigar-portal", feature: "karigar_portal" },
  { prefix: "/billing/purchases", feature: "supplier_management" },
  { prefix: "/control/tally-export", feature: "export" },
];

/** Paths that never require a plan feature (always reachable for ERP workspace). */
const ALWAYS_ALLOWED_PREFIXES = [
  "/app",
  "/mtg",
  "/settings",
  "/help",
  "/control/customization",
  "/control/accounts",
  "/control/migration",
  "/treasury",
  "/expenses",
  "/settlement",
  "/people",
  "/assistant",
  "/hardware",
];

/**
 * MTG edition: tile-first surface. Deep-links outside this allowlist are denied
 * even if the underlying module feature is on (full ERP chrome stays on AVS plans).
 */
const MTG_ALLOWED_PREFIXES = [
  "/mtg",
  "/app",
  "/settings",
  "/help",
  "/control/customization",
  "/control/accounts",
  "/control/migration",
  "/treasury",
  "/expenses",
  "/settlement",
  "/people",
  "/assistant",
  "/hardware",
  "/stock",
  "/orders",
  "/billing",
  "/workshop",
  "/melt",
  "/conversion",
  "/repair",
  "/reports",
  "/ledger",
  "/communications",
  "/whatsapp",
  "/attendance",
  "/customer-portal",
  "/karigar-portal",
  "/barcode",
];

/** Explicit MTG denylist (hide ≠ delete — routes remain for other editions). */
const MTG_DENIED_PREFIXES = ["/stock/boxes", "/scheme", "/boolean-ledger", "/ledger/boolean"];

export function featureRequiredForPath(pathname: string): EntitlementFeatureKey | null {
  for (const p of ALWAYS_ALLOWED_PREFIXES) {
    if (pathname === p || pathname.startsWith(`${p}/`)) return null;
  }
  const sorted = [...ROUTE_FEATURE_PREFIXES].sort((a, b) => b.prefix.length - a.prefix.length);
  for (const { prefix, feature } of sorted) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return feature;
  }
  return null;
}

function mtgPathAllowed(pathname: string): boolean {
  if (MTG_DENIED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return false;
  }
  return MTG_ALLOWED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function pathAllowedByEntitlements(
  pathname: string,
  hasFeature: (key: string) => boolean,
  entitlementsLoaded: boolean,
  opts?: { isMtg?: boolean },
): boolean {
  if (!entitlementsLoaded) return true;
  if (opts?.isMtg && !mtgPathAllowed(pathname)) return false;
  const required = featureRequiredForPath(pathname);
  if (!required) return true;
  return hasFeature(required);
}
