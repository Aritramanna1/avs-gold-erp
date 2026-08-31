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

export async function fetchCommunicationRateCards(opts?: {
  firmId?: string;
  messageCategory?: MessageCategory;
}): Promise<CommunicationRateCard[]> {
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
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(mapRow);
}
