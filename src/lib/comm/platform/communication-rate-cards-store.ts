/**
 * Versioned communication rate cards (Meta pricing + AVS markup).
 */
import { dataProvider as supabase } from "@/lib/providers/data-provider";

export type MessageCategory = "utility" | "marketing" | "authentication" | "service";
export type BillingResponsibility = "AVS" | "CLIENT";

export interface CommunicationRateCard {
  id: string;
  rateCardVersion: string;
  provider: string;
  pricingSource: string;
  countryCode: string;
  market?: string;
  messageCategory: MessageCategory;
  effectiveFrom: string;
  effectiveTo?: string;
  metaUnitCost: number;
  currency: string;
  avsMarkupType: "NONE" | "PERCENTAGE" | "FIXED";
  markupValue: number;
  creditsPerUnit: number;
  planCode?: string;
  firmId?: string;
  isActive: boolean;
}

function mapRow(row: Record<string, unknown>): CommunicationRateCard {
  return {
    id: String(row.id),
    rateCardVersion: String(row.rate_card_version),
    provider: String(row.provider),
    pricingSource: String(row.pricing_source),
    countryCode: String(row.country_code),
    market: row.market ? String(row.market) : undefined,
    messageCategory: String(row.message_category) as MessageCategory,
    effectiveFrom: String(row.effective_from),
    effectiveTo: row.effective_to ? String(row.effective_to) : undefined,
    metaUnitCost: Number(row.meta_unit_cost ?? 0),
    currency: String(row.currency ?? "INR"),
    avsMarkupType: String(row.avs_markup_type ?? "NONE") as CommunicationRateCard["avsMarkupType"],
    markupValue: Number(row.markup_value ?? 0),
    creditsPerUnit: Number(row.credits_per_unit ?? 1),
    planCode: row.plan_code ? String(row.plan_code) : undefined,
    firmId: row.firm_id ? String(row.firm_id) : undefined,
    isActive: Boolean(row.is_active),
  };
}

export const CANONICAL_WHATSAPP_PRICING = {
  utility: {
    category: "utility" as MessageCategory,
    title: "WhatsApp Utility (Invoices & OTP)",
    metaCostRupees: 0.11,
    avsMarkupRupees: 0.20,
    totalRupees: 0.31,
    creditsPerUnit: 0.31,
    description: "Tax invoices, Jama slips, order confirmation, Karigar issue alerts, and OTP verification codes.",
  },
  marketing: {
    category: "marketing" as MessageCategory,
    title: "WhatsApp Marketing (Campaigns)",
    metaCostRupees: 0.78,
    avsMarkupRupees: 0.20,
    totalRupees: 0.98,
    creditsPerUnit: 0.98,
    description: "Jewellery catalog collections, festival greetings, promotional announcements, and customer outreach.",
  },
  service: {
    category: "service" as MessageCategory,
    title: "Customer Service (24h Window)",
    metaCostRupees: 0.00,
    avsMarkupRupees: 0.20,
    totalRupees: 0.20,
    creditsPerUnit: 0.20,
    description: "Customer-initiated inquiries and replies within active 24-hour service conversation windows.",
  },
} as const;

export const DEFAULT_COMMUNICATION_RATE_CARDS: CommunicationRateCard[] = [
  {
    id: "rc_wa_utility",
    rateCardVersion: "v1.0",
    provider: "meta_whatsapp",
    pricingSource: "official_meta_tier1",
    countryCode: "IN",
    messageCategory: "utility",
    effectiveFrom: "2026-01-01",
    metaUnitCost: 0.11,
    currency: "INR",
    avsMarkupType: "FIXED",
    markupValue: 0.20,
    creditsPerUnit: 0.31,
    isActive: true,
  },
  {
    id: "rc_wa_marketing",
    rateCardVersion: "v1.0",
    provider: "meta_whatsapp",
    pricingSource: "official_meta_tier1",
    countryCode: "IN",
    messageCategory: "marketing",
    effectiveFrom: "2026-01-01",
    metaUnitCost: 0.78,
    currency: "INR",
    avsMarkupType: "FIXED",
    markupValue: 0.20,
    creditsPerUnit: 0.98,
    isActive: true,
  },
  {
    id: "rc_wa_service",
    rateCardVersion: "v1.0",
    provider: "meta_whatsapp",
    pricingSource: "official_meta_tier1",
    countryCode: "IN",
    messageCategory: "service",
    effectiveFrom: "2026-01-01",
    metaUnitCost: 0.00,
    currency: "INR",
    avsMarkupType: "FIXED",
    markupValue: 0.20,
    creditsPerUnit: 0.20,
    isActive: true,
  },
];

export async function fetchCommunicationRateCards(opts?: {
  firmId?: string;
  messageCategory?: MessageCategory;
}): Promise<CommunicationRateCard[]> {
  try {
    let query = supabase
      .from("communication_rate_cards" as never)
      .select("*")
      .eq("is_active", true)
      .order("effective_from", { ascending: false });

    if (opts?.messageCategory) {
      query = query.eq("message_category", opts.messageCategory);
    }
    if (opts?.firmId) {
      query = query.or(`firm_id.is.null,firm_id.eq.${opts.firmId}`);
    } else {
      query = query.is("firm_id", null);
    }

    const { data, error } = await query;
    if (!error && data && (data as Record<string, unknown>[]).length > 0) {
      return (data as Record<string, unknown>[]).map(mapRow);
    }
  } catch {
    // Fall back to canonical rates
  }

  if (opts?.messageCategory) {
    return DEFAULT_COMMUNICATION_RATE_CARDS.filter((rc) => rc.messageCategory === opts.messageCategory);
  }
  return DEFAULT_COMMUNICATION_RATE_CARDS;
}
