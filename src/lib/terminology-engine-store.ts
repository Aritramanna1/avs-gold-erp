/**
 * AVS ERP — Canonical Jewellery Terminology Engine (42 Terms)
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
  {
    key: "delivery_challan",
    number: 21,
    description: "Non-tax delivery or inter-branch transfer slip",
    indianTrade: "Challan",
    standardBusiness: "Delivery Challan",
    internationalFormal: "Dispatch Note",
    manufacturerDefault: "Delivery Challan",
    wholesalerDefault: "Dispatch Challan",
    retailDefault: "Delivery Slip",
  },
  {
    key: "rate_cut_settle",
    number: 22,
    description: "Fixing gold purchase/sale price against open metal",
    indianTrade: "Bhav Cut / Rate Cut",
    standardBusiness: "Rate Settlement",
    internationalFormal: "Price Fixing Contract",
    manufacturerDefault: "Bhav Cut",
    wholesalerDefault: "Rate Settlement",
    retailDefault: "Gold Rate Fixing",
  },
  {
    key: "metal_deposit",
    number: 23,
    description: "Physical gold held in advance for future orders",
    indianTrade: "Anamat / Gold Jama",
    standardBusiness: "Customer Metal Advance",
    internationalFormal: "Client Metal Deposit",
    manufacturerDefault: "Customer Gold Deposit",
    wholesalerDefault: "Dealer Metal Advance",
    retailDefault: "Customer Gold Advance",
  },
  {
    key: "gold_balance",
    number: 24,
    description: "Net fine gold receivable from or payable to party",
    indianTrade: "Gold Baki / Balance",
    standardBusiness: "Metal Outstanding",
    internationalFormal: "Net Metal Balance",
    manufacturerDefault: "Metal Custody Balance",
    wholesalerDefault: "Gold Balance",
    retailDefault: "Gold Account",
  },
  {
    key: "financial_receivable",
    number: 25,
    description: "Net monetary cash owed by customer or dealer",
    indianTrade: "Udhar Baki / Len-den",
    standardBusiness: "Outstanding Receivable",
    internationalFormal: "Accounts Receivable",
    manufacturerDefault: "Receivables",
    wholesalerDefault: "Dealer Outstanding",
    retailDefault: "Customer Outstanding",
  },
  {
    key: "cash_receipt",
    number: 26,
    description: "Money received via cash, cheque, NEFT, or UPI",
    indianTrade: "Jama Slip / Receipt",
    standardBusiness: "Cash Receipt",
    internationalFormal: "Payment Receipt",
    manufacturerDefault: "Cash Receipt",
    wholesalerDefault: "Collection Receipt",
    retailDefault: "Payment Receipt",
  },
  {
    key: "cash_payment",
    number: 27,
    description: "Money paid out to supplier, karigar, or expense",
    indianTrade: "Bhugtan / Payment",
    standardBusiness: "Payment Voucher",
    internationalFormal: "Disbursal Voucher",
    manufacturerDefault: "Cash Payment",
    wholesalerDefault: "Supplier Payment",
    retailDefault: "Expense / Payout",
  },
  {
    key: "sales_invoice",
    number: 28,
    description: "Legal GST tax invoice for jewellery delivery",
    indianTrade: "Pukka Bill / Tax Bill",
    standardBusiness: "Tax Invoice",
    internationalFormal: "Commercial Invoice",
    manufacturerDefault: "Tax Invoice",
    wholesalerDefault: "Wholesale Invoice",
    retailDefault: "Tax Invoice / Bill",
  },
  {
    key: "estimate_slip",
    number: 29,
    description: "Non-posted estimate slip for customer quotation",
    indianTrade: "Kaccha Bill / Estimate",
    standardBusiness: "Quotation / Estimate",
    internationalFormal: "Proforma Quotation",
    manufacturerDefault: "Estimate",
    wholesalerDefault: "Proforma Estimate",
    retailDefault: "Counter Estimate",
  },
  {
    key: "old_gold_purchase",
    number: 30,
    description: "Customer or dealer scrap gold bought for melting",
    indianTrade: "Old Gold / Khadda",
    standardBusiness: "Old Gold Purchase",
    internationalFormal: "Scrap Buyback",
    manufacturerDefault: "Scrap Purchase",
    wholesalerDefault: "Metal Inward",
    retailDefault: "Old Gold Exchange",
  },
  {
    key: "refinery_melting",
    number: 31,
    description: "Melting scrap gold into standard pure bullion bars",
    indianTrade: "Ghalai / Refinery",
    standardBusiness: "Refining & Assaying",
    internationalFormal: "Smelting & Assaying",
    manufacturerDefault: "Melting & Assay",
    wholesalerDefault: "Melting Lot",
    retailDefault: "Refinery Batch",
  },
  {
    key: "hallmark_huid",
    number: 32,
    description: "Mandatory 6-character laser engraved assay seal",
    indianTrade: "Hallmark / HUID",
    standardBusiness: "BIS Hallmarking (HUID)",
    internationalFormal: "Official Assay Hallmark",
    manufacturerDefault: "Hallmark (HUID)",
    wholesalerDefault: "Hallmark HUID",
    retailDefault: "BIS Hallmark Seal",
  },
  {
    key: "enameling_mina",
    number: 33,
    description: "Colored vitreous enamel art on jewellery surface",
    indianTrade: "Mina Kaam / Meenakari",
    standardBusiness: "Enameling / Meena",
    internationalFormal: "Enamel Crafting",
    manufacturerDefault: "Mina Work",
    wholesalerDefault: "Mina Processing",
    retailDefault: "Enamel Work",
  },
  {
    key: "polishing_finish",
    number: 34,
    description: "High-luster magnetic and ultrasonic surface finish",
    indianTrade: "Chhulai / Polish",
    standardBusiness: "Polishing & Cleaning",
    internationalFormal: "Surface Finishing",
    manufacturerDefault: "High-Gloss Polish",
    wholesalerDefault: "Final Polish",
    retailDefault: "Showroom Polish",
  },
  {
    key: "studded_gemstone",
    number: 35,
    description: "Non-diamond precious and semi-precious stones",
    indianTrade: "Nagina / Stone",
    standardBusiness: "Colored Gemstone",
    internationalFormal: "Mounted Gemstone",
    manufacturerDefault: "Stones / Nag",
    wholesalerDefault: "Gemstones",
    retailDefault: "Stones (Ruby/Emerald)",
  },
  {
    key: "cut_diamond",
    number: 36,
    description: "Natural or lab-grown faceted diamonds",
    indianTrade: "Heera / Diamond",
    standardBusiness: "Cut & Polished Diamond",
    internationalFormal: "Natural/Lab Diamond",
    manufacturerDefault: "Diamonds / Heera",
    wholesalerDefault: "Loose Diamonds",
    retailDefault: "Certified Diamonds",
  },
  {
    key: "repair_order",
    number: 37,
    description: "Fixing broken jewellery or resizing rings",
    indianTrade: "Marammat / Repair",
    standardBusiness: "Repair Order",
    internationalFormal: "Service & Restoration",
    manufacturerDefault: "Workshop Repair",
    wholesalerDefault: "Reconditioning",
    retailDefault: "Customer Repair",
  },
  {
    key: "outside_contractor",
    number: 38,
    description: "Specialized outside vendor (Mina, Micro-setting)",
    indianTrade: "Outside Karigar",
    standardBusiness: "Process Subcontractor",
    internationalFormal: "External Specialist",
    manufacturerDefault: "Subcontractor",
    wholesalerDefault: "Outside Vendor",
    retailDefault: "Workshop Specialist",
  },
  {
    key: "salesperson_agent",
    number: 39,
    description: "Staff or broker driving sales and bookings",
    indianTrade: "Salesman / Dalal",
    standardBusiness: "Sales Executive / Agent",
    internationalFormal: "Sales Representative",
    manufacturerDefault: "Trade Broker",
    wholesalerDefault: "Field Sales Agent",
    retailDefault: "Showroom Executive",
  },
  {
    key: "inter_branch_move",
    number: 40,
    description: "Stock transfer between registered firm locations",
    indianTrade: "Branch Transfer",
    standardBusiness: "Inter-Branch Transfer",
    internationalFormal: "Facility Transfer",
    manufacturerDefault: "Factory to Showroom",
    wholesalerDefault: "Warehouse Transfer",
    retailDefault: "Showroom Transfer",
  },
  {
    key: "tray_box_location",
    number: 41,
    description: "Physical container holding finished inventory tags",
    indianTrade: "Dabba / Tray / Box",
    standardBusiness: "Showcase Tray / Safe",
    internationalFormal: "Storage Box / Slot",
    manufacturerDefault: "Vault Tray",
    wholesalerDefault: "Warehouse Box",
    retailDefault: "Display Tray / Counter",
  },
  {
    key: "pawn_loan_pledge",
    number: 42,
    description: "Pledged jewellery against short-term loan (optional retail)",
    indianTrade: "Girvi / Rahan",
    standardBusiness: "Gold Loan Pledge",
    internationalFormal: "Collateral Pledge",
    manufacturerDefault: "Excluded (Retail)",
    wholesalerDefault: "Excluded (Retail)",
    retailDefault: "Gold Loan (Optional)",
  },
  {
    key: "ledger_narration",
    number: 43,
    description: "Explanation stored on the voucher; printed, shared, searchable",
    indianTrade: "Narration",
    standardBusiness: "Transaction Notes",
    internationalFormal: "Memo",
    manufacturerDefault: "Narration",
    wholesalerDefault: "Narration",
    retailDefault: "Notes",
  },
  {
    key: "handed_through",
    number: 44,
    description: "Person who handed the metal or cash (responsible person)",
    indianTrade: "Haste",
    standardBusiness: "Handed Through",
    internationalFormal: "Received / Issued By",
    manufacturerDefault: "Haste",
    wholesalerDefault: "Given By",
    retailDefault: "Received By",
  },
  {
    key: "gold_debit",
    number: 45,
    description: "Outward gold or cash. Nave is a synonym of Naam",
    indianTrade: "Naam / Nave",
    standardBusiness: "Debit / Outward",
    internationalFormal: "Payable / Outward",
    manufacturerDefault: "Naam",
    wholesalerDefault: "Naam",
    retailDefault: "Debit",
  },
  {
    key: "gold_credit",
    number: 46,
    description: "Inward gold or cash",
    indianTrade: "Jama",
    standardBusiness: "Credit / Inward",
    internationalFormal: "Receivable / Inward",
    manufacturerDefault: "Jama",
    wholesalerDefault: "Jama",
    retailDefault: "Credit",
  },
  {
    key: "hisob_effective",
    number: 47,
    description: "Tanch + Wastage on party/approval documents",
    indianTrade: "Hisob",
    standardBusiness: "Effective %",
    internationalFormal: "Contractual Fineness %",
    manufacturerDefault: "Hisob",
    wholesalerDefault: "Touch + Wastage",
    retailDefault: "Effective %",
  },
];

const TERM_KEY_ALIASES: Record<string, string> = {
  making_charges: "making_charge",
  manufacturing_job: "job_card",
  old_gold_purchase: "old_gold",
  hallmark_huid: "hallmarking_huid",
  rate_cut_settle: "rate_cut_fixation",
  outside_contractor: "outside_work",
  nave: "gold_debit",
  naam: "gold_debit",
  anamat: "metal_deposit",
  haste: "handed_through",
  narration: "ledger_narration",
  hisob: "hisob_effective",
  hishob: "hisob_effective",
};

const EXTRA_DISPLAY_PHRASES: Record<string, string[]> = {
  worker_artisan: ["Karigar", "Karigars", "Worker", "Workers", "Artisan", "Artisans"],
  party_customer: ["Customer", "Customers", "Client", "Clients", "Grahak"],
  party_supplier: ["Supplier", "Suppliers", "Vendor", "Vendors", "Mahajan"],
  account_ledger: ["Gold & Material Ledger", "Gold Ledger"],
  making_charge: ["Making Charges", "Making Charge"],
  metal_purity_touch: ["Purity / Touch", "Touch %"],
  fine_metal_weight: ["Fine Gold", "Fine Wt"],
  gross_weight: ["Gross Weight", "Gross Wt"],
  net_weight: ["Net Weight", "Net Wt"],
  loss_wastage: ["Wastage"],
  job_card: ["Job Cards", "Job Card"],
  sales_invoice: ["Tax Invoice"],
  metal_rate: ["Gold Rate", "Daily Bhav"],
  vault_custody: ["Gold Vault"],
  outside_work: ["Outside Work"],
  delivery_challan: ["Delivery Challan"],
  cash_receipt: ["Cash Receipt"],
  cash_payment: ["Cash Payment"],
};

/** Matches shop TerminologyManager (`Ki` / “42 Terms”). */
export const CANONICAL_TERM_COUNT = CANONICAL_42_TERMS.length;

interface TerminologyStore {
  activePack: TerminologyPackId;
  customOverrides: Record<string, string>;
  /** Firm/local rehydrate flag — baseline shop sets true via onRehydrateStorage. */
  hydrated: boolean;
  /** Baseline shop exposes saving badge; cloud write may be no-op until firm sync path is fully wired. */
  saving: boolean;
  setActivePack: (pack: TerminologyPackId) => void;
  setCustomOverride: (key: string, label: string) => void;
  resetCustomOverrides: () => void;
  /** Baseline shop export — persistNow was async no-op in CVsE73i6 chunk; keep signature. */
  persistNow: () => Promise<void>;
  tTerm: (key: string, fallback?: string) => string;
  tTermPrint: (key: string, fallback?: string) => string;
  applyToText: (text: string, forPrint?: boolean) => string;
}

function phraseSourcesForTerm(def: CanonicalTermDefinition): string[] {
  const out = new Set<string>();
  // Only English / explicit display aliases — never other pack destinations.
  // Using indianTrade ("Party / Grahak") as a *source* caused chained rewrites
  // when applyToText ran more than once on UI strings.
  const standard = def.standardBusiness.trim();
  if (standard) {
    out.add(standard);
    for (const part of standard.split(/\s*\/\s*/)) {
      const p = part.trim();
      if (p.length >= 8) out.add(p);
    }
  }
  for (const extra of EXTRA_DISPLAY_PHRASES[def.key] ?? []) {
    if (extra.trim() && extra.trim().length >= 8) out.add(extra.trim());
  }
  return [...out];
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const useTerminology = create<TerminologyStore>()(
  persist(
    (set, get) => ({
      activePack: "indian_trade",
      customOverrides: {},
      hydrated: false,
      saving: false,

      setActivePack: (pack) => set({ activePack: pack }),

      setCustomOverride: (key, label) => {
        set((s) => ({
          customOverrides: { ...s.customOverrides, [key]: label },
        }));
      },

      resetCustomOverrides: () => set({ customOverrides: {} }),

      // Recovered from index-CVsE73i6.js: persistNow:async()=>{}
      persistNow: async () => {},

      tTerm: (key, fallback) => {
        const { activePack, customOverrides } = get();
        const resolvedKey = TERM_KEY_ALIASES[key] ?? key;

        if (customOverrides[resolvedKey]?.trim()) {
          return customOverrides[resolvedKey].trim();
        }
        if (customOverrides[key]?.trim()) {
          return customOverrides[key].trim();
        }

        const def = CANONICAL_42_TERMS.find((t) => t.key === resolvedKey || t.key === key);
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

      tTermPrint: (key, fallback) => {
        const resolvedKey = TERM_KEY_ALIASES[key] ?? key;
        const printOverride = get().customOverrides[`${resolvedKey}__print`];
        if (printOverride?.trim()) return printOverride.trim();
        return get().tTerm(key, fallback);
      },

      applyToText: (text, forPrint = false) => {
        if (!text) return text;
        // Print templates: prefer keyed tTermPrint at call sites; avoid aggressive
        // global phrase replacement that blows out thermal columns and overlaps.
        if (forPrint) return text;
        const pairs: { from: string; to: string }[] = [];
        for (const def of CANONICAL_42_TERMS) {
          const to = get().tTerm(def.key);
          for (const from of phraseSourcesForTerm(def)) {
            if (
              from &&
              to &&
              from.toLowerCase() !== to.toLowerCase() &&
              from.length >= 8 &&
              // Never expand a phrase into text that still contains the source
              // token (guards against accidental recursive growth).
              !to.toLowerCase().includes(from.toLowerCase())
            ) {
              pairs.push({ from, to });
            }
          }
        }
        pairs.sort((a, b) => b.from.length - a.from.length);
        let out = text;
        const seen = new Set<string>();
        for (const { from, to } of pairs) {
          const k = from.toLowerCase();
          if (seen.has(k)) continue;
          seen.add(k);
          // Skip if the destination label is already present (idempotent / no double-apply).
          if (out.toLowerCase().includes(to.toLowerCase()) && !out.toLowerCase().includes(k)) {
            continue;
          }
          out = out.replace(new RegExp(escapeRegExp(from), "gi"), to);
        }
        return out;
      },
    }),
    {
      name: "ornexa-terminology-engine-v1",
      onRehydrateStorage: () => () => {
        useTerminology.setState({ hydrated: true });
      },
    },
  ),
);

/** Recovered from index-CVsE73i6.js `Jl` — mark hydrated if persist rehydrate has not yet. */
export async function ensureTerminologyLoaded(): Promise<void> {
  await Promise.resolve();
  if (!useTerminology.getState().hydrated) {
    useTerminology.setState({ hydrated: true });
  }
}

export function applyTenantTerminology(text: string, forPrint = false): string {
  return useTerminology.getState().applyToText(text, forPrint);
}
