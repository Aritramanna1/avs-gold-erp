/**
 * AVS Owner commercial ladder — ₹10k / ₹30k / ₹50k + MTG.
 * Master Reference: docs/MASTER/BUSINESS_PRODUCT_AND_ENTITLEMENT_MASTER.md
 */

export type CommercialPlanTier = "avs_10k" | "avs_30k" | "avs_50k" | "avs_mtg";

export type DeviceClientSurface = "client.web" | "client.desktop" | "client.mobile";

export interface CommercialPlanConfig {
  id: CommercialPlanTier;
  name: string;
  code: string;
  tagline: string;
  pricingMonthlyINR: number;
  pricingAnnualINR: number;
  maxSeats: number;
  maxBranches: number;
  allowedSurfaces: DeviceClientSurface[];
  surfaceSelectionPolicy: "choose_1_no_mobile" | "choose_1_any" | "choose_2" | "all_3";
  features: string[];
}

export const COMMERCIAL_PLANS: Record<CommercialPlanTier, CommercialPlanConfig> = {
  avs_10k: {
    id: "avs_10k",
    name: "AVS Manufacturing · ₹10k",
    code: "AVS_MANUFACTURING_10K",
    tagline: "Entry workshop ERP — stock, orders, workshop, ledger",
    pricingMonthlyINR: 833,
    pricingAnnualINR: 10000,
    maxSeats: 3,
    maxBranches: 1,
    allowedSurfaces: ["client.web", "client.desktop"],
    surfaceSelectionPolicy: "choose_1_no_mobile",
    features: [
      "business.core",
      "business.orders",
      "business.workshop",
      "business.ledger",
      "business.billing_basic",
      "business.inventory",
    ],
  },
  avs_30k: {
    id: "avs_30k",
    name: "AVS Manufacturing · ₹30k",
    code: "AVS_MANUFACTURING_30K",
    tagline: "Standard manufacturing — GST, conversions, CRM, barcode",
    pricingMonthlyINR: 2500,
    pricingAnnualINR: 30000,
    maxSeats: 10,
    maxBranches: 2,
    allowedSurfaces: ["client.web", "client.desktop", "client.mobile"],
    surfaceSelectionPolicy: "choose_2",
    features: [
      "business.core",
      "business.orders",
      "business.workshop",
      "business.ledger",
      "business.billing_full",
      "business.barcode",
      "business.gst",
      "business.item_masters",
      "business.customer_portal",
      "business.document_hosting",
    ],
  },
  avs_50k: {
    id: "avs_50k",
    name: "AVS Manufacturing · ₹50k",
    code: "AVS_MANUFACTURING_50K",
    tagline: "Professional — multi-branch, analytics, supplier, full portals",
    pricingMonthlyINR: 4167,
    pricingAnnualINR: 50000,
    maxSeats: 25,
    maxBranches: 3,
    allowedSurfaces: ["client.web", "client.desktop", "client.mobile"],
    surfaceSelectionPolicy: "all_3",
    features: [
      "business.core",
      "business.orders",
      "business.workshop_full",
      "business.ledger",
      "business.billing_gst_einv",
      "business.barcode_tagging",
      "business.item_masters",
      "business.analytics",
      "business.multi_branch",
      "business.api_webhooks",
      "business.document_hosting",
      "business.karigar_portal",
      "business.supplier_portal",
    ],
  },
  avs_mtg: {
    id: "avs_mtg",
    name: "AVS MTG Simplified",
    code: "AVS_MTG",
    tagline: "Simplified MTG/MTJ shell — gold-first manufacturing",
    pricingMonthlyINR: 833,
    pricingAnnualINR: 10000,
    maxSeats: 5,
    maxBranches: 1,
    allowedSurfaces: ["client.web", "client.mobile"],
    surfaceSelectionPolicy: "choose_1_any",
    features: [
      "business.core",
      "business.orders",
      "business.workshop",
      "business.ledger",
      "business.mtg_shell",
      "business.inventory",
    ],
  },
};

/** Locked Owner ladder — only these tiers are assignable for new trials. */
export const AVS_ASSIGNABLE_PLAN_CODES = [
  "avs_manufacturing_10k",
  "avs_manufacturing_30k",
  "avs_manufacturing_50k",
  "avs_mtg",
] as const;

export function validateDeviceSurfaceEntitlement(
  tier: CommercialPlanTier,
  selectedSurfaces: DeviceClientSurface[],
): { allowed: boolean; reason?: string } {
  const plan = COMMERCIAL_PLANS[tier];
  if (!plan) return { allowed: false, reason: "Invalid plan tier" };

  for (const s of selectedSurfaces) {
    if (!plan.allowedSurfaces.includes(s)) {
      return {
        allowed: false,
        reason: `Surface '${s}' is not permitted under ${plan.name}`,
      };
    }
  }

  switch (plan.surfaceSelectionPolicy) {
    case "choose_1_no_mobile":
      if (selectedSurfaces.length > 1) {
        return { allowed: false, reason: "₹10k plan permits only 1 client surface (no mobile)" };
      }
      if (selectedSurfaces.includes("client.mobile")) {
        return { allowed: false, reason: "₹10k plan does not include mobile access" };
      }
      break;
    case "choose_1_any":
      if (selectedSurfaces.length > 1) {
        return { allowed: false, reason: "MTG plan permits only 1 client surface" };
      }
      break;
    case "choose_2":
      if (selectedSurfaces.length > 2) {
        return { allowed: false, reason: `${plan.name} permits up to 2 client surfaces` };
      }
      break;
    case "all_3":
      break;
  }

  return { allowed: true };
}
