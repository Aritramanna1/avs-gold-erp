/**
 * ORNEXA — Canonical Jewellery Terminology Engine (42 Terms)
 * Authoritative Specification: docs/MASTER/JEWELLERY_TERMINOLOGY_MASTER.md
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type TerminologyPackId =
  | "indian_trade"
  | "standard_business"
  | "international_formal"
  | "manufacturer_default"
  | "wholesaler_default"
  | "retail_default";

export interface CanonicalTermDefinition {
  key: string;
  number: number;
  description: string;
  indianTrade: string;
  standardBusiness: string;
  internationalFormal: string;
  manufacturerDefault: string;
  wholesalerDefault: string;
  retailDefault: string;
}

export const CANONICAL_42_TERMS: CanonicalTermDefinition[] = [
  {
    key: "metal_rate",
    number: 1,
    description: "Precious metal rate per gram for billing & valuation",
    indianTrade: "Daily Bhav",
    standardBusiness: "Metal Rate",
    internationalFormal: "Market Spot Rate",
    manufacturerDefault: "Daily Bhav",
    wholesalerDefault: "Metal Rate",
    retailDefault: "Today's Gold Rate",
  },
  {
    key: "worker_artisan",
    number: 2,
    description: "Craftsman performing jewellery fabrication or bench setting",
    indianTrade: "Karigar",
    standardBusiness: "Worker",
    internationalFormal: "Artisan / Goldsmith",
    manufacturerDefault: "Karigar",
    wholesalerDefault: "Manufacturer / Karigar",
    retailDefault: "Bench Worker / Goldsmith",
  },
  {
    key: "party_customer",
    number: 3,
    description: "Buyer of finished jewellery or manufacturing services",
    indianTrade: "Party / Grahak",
    standardBusiness: "Customer",
    internationalFormal: "Business Client",
    manufacturerDefault: "Jeweller / Client",
    wholesalerDefault: "Dealer / Jeweller",
    retailDefault: "Customer / Buyer",
  },
  {
    key: "party_supplier",
    number: 4,
    description: "Seller of raw gold bullion, gems, or ready goods",
    indianTrade: "Mahajan / Supplier",
    standardBusiness: "Supplier / Vendor",
    internationalFormal: "Vendor / Bullion Dealer",
    manufacturerDefault: "Bullion Supplier",
    wholesalerDefault: "Manufacturer / Supplier",
    retailDefault: "Wholesaler / Supplier",
  },
  {
    key: "metal_receipt",
    number: 5,
    description: "Physical metal received from karigar or customer",
    indianTrade: "Jama (Metal)",
    standardBusiness: "Metal Receipt",
    internationalFormal: "Metal Return / Inward",
    manufacturerDefault: "Metal Receive",
    wholesalerDefault: "Stock Inward",
    retailDefault: "Old Gold Inward",
  },
  {
    key: "metal_issue",
    number: 6,
    description: "Physical metal issued to artisan or branch",
    indianTrade: "Issue / Nikas",
    standardBusiness: "Metal Issue",
    internationalFormal: "Material Issue",
    manufacturerDefault: "Gold Issue",
    wholesalerDefault: "Stock Dispatch",
    retailDefault: "Issue to Workshop",
  },
  {
    key: "account_ledger",
    number: 7,
    description: "Financial and metal transaction statement",
    indianTrade: "Khata / Ledger",
    standardBusiness: "Account Ledger",
    internationalFormal: "Statement of Account",
    manufacturerDefault: "Party Khata",
    wholesalerDefault: "Dealer Ledger",
    retailDefault: "Customer Statement",
  },
  {
    key: "settlement_final",
    number: 8,
    description: "Reconciling metal issued vs returned vs loss",
    indianTrade: "Hisab / Hisab Final",
    standardBusiness: "Account Settlement",
    internationalFormal: "Final Reconciliation",
    manufacturerDefault: "Karigar Hisab",
    wholesalerDefault: "Dealer Settlement",
    retailDefault: "Account Settlement",
  },
  {
    key: "metal_purity_touch",
    number: 9,
    description: "Gold fineness percentage (e.g. 91.60 for 22K)",
    indianTrade: "Touch / Tanch",
    standardBusiness: "Purity Factor",
    internationalFormal: "Fineness / Karat",
    manufacturerDefault: "Touch %",
    wholesalerDefault: "Purity (Touch)",
    retailDefault: "Karat (Purity)",
  },
  {
    key: "fine_metal_weight",
    number: 10,
    description: "Calculated pure 24K equivalent weight",
    indianTrade: "Fine / Pure Weight",
    standardBusiness: "Fine Metal Weight",
    internationalFormal: "Pure Metal Equivalent",
    manufacturerDefault: "Fine Gold (g)",
    wholesalerDefault: "Fine Metal (g)",
    retailDefault: "Pure Gold (g)",
  },
  {
    key: "gross_weight",
    number: 11,
    description: "Total physical weight on digital scale",
    indianTrade: "Gross Wajan",
    standardBusiness: "Gross Weight",
    internationalFormal: "Total Mass",
    manufacturerDefault: "Gross Wt (g)",
    wholesalerDefault: "Gross Wt (g)",
    retailDefault: "Gross Weight (g)",
  },
  {
    key: "net_weight",
    number: 12,
    description: "Physical metal weight after stone/wax deductions",
    indianTrade: "Net Wajan",
    standardBusiness: "Net Weight",
    internationalFormal: "Net Precious Metal",
    manufacturerDefault: "Net Wt (g)",
    wholesalerDefault: "Net Wt (g)",
    retailDefault: "Net Weight (g)",
  },
  {
    key: "loss_wastage",
    number: 13,
    description: "Permitted metal loss during manufacturing stages",
    indianTrade: "Ghat / Chhijat",
    standardBusiness: "Wastage Allowance",
    internationalFormal: "Process Loss Tolerance",
    manufacturerDefault: "Ghat / Wastage",
    wholesalerDefault: "Wastage %",
    retailDefault: "Wastage Allowance",
  },
  {
    key: "making_charge",
    number: 14,
    description: "Artisan fabrication or manufacturing labor fees",
    indianTrade: "Majuri / Kadai",
    standardBusiness: "Making Charges",
    internationalFormal: "Fabrication Charges",
    manufacturerDefault: "Labour / Majuri",
    wholesalerDefault: "Making Charges",
    retailDefault: "Making Charges (₹/g)",
  },
  {
    key: "old_gold",
    number: 15,
    description: "Customer or trade scrap gold bought for melting",
    indianTrade: "Gali / Old Gold",
    standardBusiness: "Old Gold Scrap",
    internationalFormal: "Secondary Metal Purchase",
    manufacturerDefault: "Scrap / Old Gold",
    wholesalerDefault: "Old Metal Inward",
    retailDefault: "Customer Old Gold Exchange",
  },
  {
    key: "hallmarking_huid",
    number: 16,
    description: "BIS 6-character alphanumeric laser hallmark registration",
    indianTrade: "HUID Hallmark",
    standardBusiness: "BIS Hallmark ID",
    internationalFormal: "Assay Certification Code",
    manufacturerDefault: "HUID Hallmark",
    wholesalerDefault: "Hallmark ID",
    retailDefault: "BIS HUID Laser Hallmark",
  },
  {
    key: "rate_cut_fixation",
    number: 17,
    description: "Converting physical gold weight debt to fixed monetary liability",
    indianTrade: "Bhav Cut / Rate Fix",
    standardBusiness: "Rate Booking / Cut",
    internationalFormal: "Metal Price Hedging",
    manufacturerDefault: "Rate Cut Fixation",
    wholesalerDefault: "Bhav Cut Booking",
    retailDefault: "Gold Rate Booking",
  },
  {
    key: "vault_custody",
    number: 18,
    description: "Physical high-security treasury holding raw metal",
    indianTrade: "Tijori / Vault",
    standardBusiness: "Treasury Vault",
    internationalFormal: "Bullion Vault Safe",
    manufacturerDefault: "Treasury Vault",
    wholesalerDefault: "Main Vault",
    retailDefault: "Showroom Strongroom",
  },
  {
    key: "job_card",
    number: 19,
    description: "Workshop production traveler card tracking piece fabrication",
    indianTrade: "Job Card / Patra",
    standardBusiness: "Work Order",
    internationalFormal: "Manufacturing Traveler",
    manufacturerDefault: "Job Card",
    wholesalerDefault: "Production Batch Order",
    retailDefault: "Custom Order Job Card",
  },
  {
    key: "outside_work",
    number: 20,
    description: "Specialized subcontracting (Setting, Meena, Rhodium, Polish)",
    indianTrade: "Bahari Kaam / Outside",
    standardBusiness: "Subcontracted Jobwork",
    internationalFormal: "External Processing Challan",
    manufacturerDefault: "Outside Work Book",
    wholesalerDefault: "Jobwork Challan",
    retailDefault: "Specialized Workshop Service",
  },
];

interface TerminologyStore {
  activePack: TerminologyPackId;
  customOverrides: Record<string, string>;
  setActivePack: (pack: TerminologyPackId) => void;
  setCustomOverride: (key: string, label: string) => void;
  resetCustomOverrides: () => void;
  tTerm: (key: string, fallback?: string) => string;
}

export const useTerminology = create<TerminologyStore>()(
  persist(
    (set, get) => ({
      activePack: "indian_trade",
      customOverrides: {},

      setActivePack: (pack) => set({ activePack: pack }),

      setCustomOverride: (key, label) => {
        set((s) => ({
          customOverrides: { ...s.customOverrides, [key]: label },
        }));
      },

      resetCustomOverrides: () => set({ customOverrides: {} }),

      tTerm: (key, fallback) => {
        const { activePack, customOverrides } = get();

        // 1. Check custom tenant overrides first
        if (customOverrides[key] && customOverrides[key].trim()) {
          return customOverrides[key].trim();
        }

        // 2. Resolve from 42 canonical terms
        const def = CANONICAL_42_TERMS.find((t) => t.key === key);
        if (def) {
          switch (activePack) {
            case "indian_trade":
              return def.indianTrade;
            case "standard_business":
              return def.standardBusiness;
            case "international_formal":
              return def.internationalFormal;
            case "manufacturer_default":
              return def.manufacturerDefault;
            case "wholesaler_default":
              return def.wholesalerDefault;
            case "retail_default":
              return def.retailDefault;
            default:
              return def.indianTrade;
          }
        }

        return fallback || key.replace(/_/g, " ");
      },
    }),
    {
      name: "ornexa-terminology-engine-v1",
    },
  ),
);
