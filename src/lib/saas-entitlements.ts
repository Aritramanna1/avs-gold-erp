/**
 * ORNEXA — 5 Commercial Plan Tiers & Device Surface Entitlements
 * Master Reference: docs/MASTER/BUSINESS_PRODUCT_AND_ENTITLEMENT_MASTER.md & DEVICE_ACCESS_MASTER.md
 */

export type CommercialPlanTier = "basic" | "growth" | "professional" | "scale" | "max";

export type DeviceClientSurface = "client.web" | "client.desktop" | "client.mobile";

export interface CommercialPlanConfig {
  id: CommercialPlanTier;
  name: string;
  code: string;
  tagline: string;
  pricingMonthlyINR: number;
  pricingAnnualINR: number;
  maxSeats: number;
  maxBranches: number; // 1 base branch included, extra as add-ons
  allowedSurfaces: DeviceClientSurface[];
  surfaceSelectionPolicy: "choose_1_no_mobile" | "choose_1_any" | "choose_2" | "all_3";
  features: string[];
}

export const COMMERCIAL_PLANS: Record<CommercialPlanTier, CommercialPlanConfig> = {
  basic: {
    id: "basic",
    name: "Basic Plan",
    code: "ORNEXA_BASIC",
    tagline: "Essential jewellery workshop and ledger accounting",
    pricingMonthlyINR: 1999,
    pricingAnnualINR: 19990,
    maxSeats: 2,
    maxBranches: 1,
    allowedSurfaces: ["client.web", "client.desktop"],
    surfaceSelectionPolicy: "choose_1_no_mobile",
    features: [
      "business.core",
      "business.people",
      "business.orders",
      "business.workshop",
      "business.ledger",
      "business.billing_basic",
    ],
  },
  growth: {
    id: "growth",
    name: "Growth Plan",
    code: "ORNEXA_GROWTH",
    tagline: "Complete single-branch workshop and retail billing",
    pricingMonthlyINR: 3999,
    pricingAnnualINR: 39990,
    maxSeats: 5,
    maxBranches: 1,
    allowedSurfaces: ["client.web", "client.desktop", "client.mobile"],
    surfaceSelectionPolicy: "choose_1_any",
    features: [
      "business.core",
      "business.people",
      "business.orders",
      "business.workshop",
      "business.ledger",
      "business.billing_full",
      "business.barcode",
      "business.reports_standard",
    ],
  },
  professional: {
    id: "professional",
    name: "Professional Plan",
    code: "ORNEXA_PRO",
    tagline: "Multi-device manufacturing with outside work & assays",
    pricingMonthlyINR: 7999,
    pricingAnnualINR: 79990,
    maxSeats: 12,
    maxBranches: 1,
    allowedSurfaces: ["client.web", "client.desktop", "client.mobile"],
    surfaceSelectionPolicy: "choose_2",
    features: [
      "business.core",
      "business.people",
      "business.orders",
      "business.workshop_advanced",
      "business.outside_work",
      "business.melting_assay",
      "business.ledger",
      "business.billing_full",
      "business.barcode_tagging",
      "business.stock_audit",
      "business.reports_full",
      "business.tally_export",
    ],
  },
  scale: {
    id: "scale",
    name: "Scale Plan",
    code: "ORNEXA_SCALE",
    tagline: "High-throughput manufacturing & wholesale operations",
    pricingMonthlyINR: 14999,
    pricingAnnualINR: 149990,
    maxSeats: 25,
    maxBranches: 1,
    allowedSurfaces: ["client.web", "client.desktop", "client.mobile"],
    surfaceSelectionPolicy: "choose_2",
    features: [
      "business.core",
      "business.people",
      "business.orders",
      "business.workshop_full",
      "business.outside_work",
      "business.melting_assay",
      "business.hallmarking_huid",
      "business.ledger_dual",
      "business.billing_gst_einv",
      "business.stock_audit_rfid",
      "business.reports_analytics",
      "business.tally_export",
      "business.ai_assistant",
      "business.custom_templates",
    ],
  },
  max: {
    id: "max",
    name: "Max Enterprise Plan",
    code: "ORNEXA_MAX",
    tagline: "Unrestricted enterprise ERP with full AI runtime & custom formulas",
    pricingMonthlyINR: 24999,
    pricingAnnualINR: 249990,
    maxSeats: 100,
    maxBranches: 1,
    allowedSurfaces: ["client.web", "client.desktop", "client.mobile"],
    surfaceSelectionPolicy: "all_3",
    features: [
      "business.core",
      "business.people",
      "business.orders",
      "business.workshop_full",
      "business.outside_work",
      "business.melting_assay",
      "business.hallmarking_huid",
      "business.ledger_dual",
      "business.billing_gst_einv",
      "business.stock_audit_rfid",
      "business.reports_analytics",
      "business.tally_export",
      "business.ai_assistant",
      "business.custom_formulas",
      "business.custom_templates",
      "business.encrypted_backups",
      "business.api_webhooks",
    ],
  },
};

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
        return { allowed: false, reason: "Basic Plan permits only 1 client surface" };
      }
      if (selectedSurfaces.includes("client.mobile")) {
        return { allowed: false, reason: "Basic Plan does not include Mobile app access" };
      }
      break;
    case "choose_1_any":
      if (selectedSurfaces.length > 1) {
        return {
          allowed: false,
          reason: "Growth Plan permits only 1 client surface (Web, Desktop, or Mobile)",
        };
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
