/**
 * WhatsApp Campaign Store — campaign manager with audience builder + states.
 */
import { create } from "zustand";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { DEFAULT_AVS_PRODUCT } from "@/lib/comm/platform/communication-events";
import { usePeople, type Person } from "@/lib/people-store";
import { useBilling } from "@/lib/billing-store";
import { fetchOptedInPhones } from "./whatsapp-opt-in-store";

export type CampaignStatus =
  | "DRAFT"
  | "READY"
  | "APPROVAL_REQUIRED"
  | "SCHEDULED"
  | "RUNNING"
  | "PAUSED"
  | "COMPLETED"
  | "PARTIAL"
  | "FAILED"
  | "CANCELLED";

export type AudienceSegmentRule =
  | { type: "outstanding_gt"; amountPaise: number }
  | { type: "order_ready" }
  | { type: "anniversary_month"; month: number }
  | { type: "purchased_within_months"; months: number }
  | { type: "city"; city: string }
  | { type: "catalog_interest"; category: string }
  | { type: "opted_in_whatsapp" }
  | { type: "custom_tag"; tag: string }
  | { type: "all_customers" };

export interface WhatsAppCampaign {
  id: string;
  name: string;
  objective?: string;
  status: CampaignStatus;
  productId: string;
  templateName?: string;
  templateLanguage: string;
  templateVariables: Record<string, string>;
  audienceType: string;
  audienceConfig: Record<string, unknown>;
  scheduledAt?: string;
  estimatedRecipients: number;
  estimatedCostPaise: number;
  estimatedCredits: number;
  stats: {
    sent: number;
    delivered: number;
    read: number;
    failed: number;
    responses: number;
    opt_outs: number;
  };
  createdAt: string;
}

export interface CampaignAudience {
  id: string;
  name: string;
  description?: string;
  segmentRules: AudienceSegmentRule[];
  estimatedCount: number;
}

function mapCampaign(row: Record<string, unknown>): WhatsAppCampaign {
  return {
    id: String(row.id),
    name: String(row.name),
    objective: row.objective ? String(row.objective) : undefined,
    status: String(row.status) as CampaignStatus,
    productId: String(row.product_id),
    templateName: row.template_name ? String(row.template_name) : undefined,
    templateLanguage: String(row.template_language ?? "en"),
    templateVariables: (row.template_variables ?? {}) as Record<string, string>,
    audienceType: String(row.audience_type ?? "segment"),
    audienceConfig: (row.audience_config ?? {}) as Record<string, unknown>,
    scheduledAt: row.scheduled_at ? String(row.scheduled_at) : undefined,
    estimatedRecipients: Number(row.estimated_recipients ?? 0),
    estimatedCostPaise: Number(row.estimated_cost_paise ?? 0),
    estimatedCredits: Number(row.estimated_credits ?? 0),
    stats: {
      sent: Number((row.stats as Record<string, number> | null)?.sent ?? 0),
      delivered: Number((row.stats as Record<string, number> | null)?.delivered ?? 0),
      read: Number((row.stats as Record<string, number> | null)?.read ?? 0),
      failed: Number((row.stats as Record<string, number> | null)?.failed ?? 0),
      responses: Number((row.stats as Record<string, number> | null)?.responses ?? 0),
      opt_outs: Number((row.stats as Record<string, number> | null)?.opt_outs ?? 0),
    },
    createdAt: String(row.created_at),
  };
}

/** Build audience from ERP data with opt-in enforcement */
export async function buildCampaignAudience(
  rules: AudienceSegmentRule[],
  productId = DEFAULT_AVS_PRODUCT,
): Promise<Array<{ partyId: string; phone: string; name: string }>> {
  const people = usePeople.getState().people;
  const invoices = useBilling.getState().invoices;
  const optedIn = new Set(await fetchOptedInPhones(productId));
  const now = new Date();
  const results: Array<{ partyId: string; phone: string; name: string }> = [];

  for (const person of people) {
    const phone = person.phone?.replace(/\D/g, "");
    if (!phone || phone.length < 10) continue;
    const e164 = phone.startsWith("91") ? phone : `91${phone}`;
    if (!optedIn.has(e164) && !rules.some((r) => r.type === "all_customers")) continue;

    let match = rules.length === 0;
    for (const rule of rules) {
      switch (rule.type) {
        case "all_customers":
          match = true;
          break;
        case "opted_in_whatsapp":
          match = optedIn.has(e164);
          break;
        case "outstanding_gt": {
          const bal = invoices
            .filter((i) => i.customerId === person.id && i.balancePaise > 0)
            .reduce((s, i) => s + i.balancePaise, 0);
          match = bal > rule.amountPaise;
          break;
        }
        case "anniversary_month": {
          const dob = person.dateOfBirth?.slice(5, 7);
          match = dob === String(rule.month).padStart(2, "0");
          break;
        }
        case "city":
          match =
            (person.villageCity ?? "").toLowerCase().includes(rule.city.toLowerCase()) ||
            (person.currentAddress ?? "").toLowerCase().includes(rule.city.toLowerCase());
          break;
        case "custom_tag":
          match = (person.notes ?? "").includes(rule.tag);
          break;
        case "purchased_within_months": {
          const cutoff = new Date(now);
          cutoff.setMonth(cutoff.getMonth() - rule.months);
          match = invoices.some(
            (i) =>
              i.customerId === person.id && new Date(i.createdAt).getTime() >= cutoff.getTime(),
          );
          break;
        }
        default:
          match = false;
      }
      if (!match) break;
    }
    if (match && optedIn.has(e164)) {
      results.push({ partyId: person.id, phone: e164, name: person.fullName });
    }
  }
  return results;
}

interface CampaignState {
  campaigns: WhatsAppCampaign[];
  audiences: CampaignAudience[];
  loading: boolean;
  hydrate: () => Promise<void>;
  createCampaign: (
    input: Partial<WhatsAppCampaign> & { name: string },
  ) => Promise<WhatsAppCampaign | null>;
  updateCampaignStatus: (id: string, status: CampaignStatus) => Promise<void>;
  launchCampaign: (id: string) => Promise<{ ok: boolean; error?: string }>;
  saveAudience: (input: Omit<CampaignAudience, "id" | "estimatedCount">) => Promise<void>;
}

export const useWhatsAppCampaignStore = create<CampaignState>()((set, get) => ({
  campaigns: [],
  audiences: [],
  loading: false,

  hydrate: async () => {
    set({ loading: true });
    const [campRes, audRes] = await Promise.all([
      supabase
        .from("whatsapp_campaigns" as never)
        .select("*")
        .eq("product_id", DEFAULT_AVS_PRODUCT)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("campaign_audiences" as never)
        .select("*")
        .eq("product_id", DEFAULT_AVS_PRODUCT)
        .eq("is_active", true),
    ]);
    if (!campRes.error && campRes.data) {
      set({ campaigns: (campRes.data as Record<string, unknown>[]).map(mapCampaign) });
    }
    if (!audRes.error && audRes.data) {
      set({
        audiences: (audRes.data as Record<string, unknown>[]).map((r) => ({
          id: String(r.id),
          name: String(r.name),
          description: r.description ? String(r.description) : undefined,
          segmentRules: (r.segment_rules ?? []) as AudienceSegmentRule[],
          estimatedCount: Number(r.estimated_count ?? 0),
        })),
      });
    }
    set({ loading: false });
  },

  createCampaign: async (input) => {
    const rules = (input.audienceConfig?.rules ?? []) as AudienceSegmentRule[];
    const audience = await buildCampaignAudience(rules);
    const { data, error } = await supabase
      .from("whatsapp_campaigns" as never)
      .insert({
        name: input.name,
        objective: input.objective ?? null,
        product_id: input.productId ?? DEFAULT_AVS_PRODUCT,
        template_name: input.templateName ?? null,
        template_language: input.templateLanguage ?? "en",
        template_variables: input.templateVariables ?? {},
        audience_type: "segment",
        audience_config: { rules },
        estimated_recipients: audience.length,
        status: "DRAFT",
      } as never)
      .select("*")
      .single();
    if (error || !data) return null;
    const campaign = mapCampaign(data as Record<string, unknown>);
    set((s) => ({ campaigns: [campaign, ...s.campaigns] }));
    return campaign;
  },

  updateCampaignStatus: async (id, status) => {
    await supabase
      .from("whatsapp_campaigns" as never)
      .update({ status, updated_at: new Date().toISOString() } as never)
      .eq("id", id);
    await get().hydrate();
  },

  launchCampaign: async (id) => {
    const campaign = get().campaigns.find((c) => c.id === id);
    if (!campaign) return { ok: false, error: "Campaign not found" };
    if (!campaign.templateName)
      return { ok: false, error: "Approved template required for campaigns" };

    await get().updateCampaignStatus(id, "RUNNING");
    const rules = (campaign.audienceConfig?.rules ?? []) as AudienceSegmentRule[];
    const audience = await buildCampaignAudience(
      rules,
      campaign.productId as typeof DEFAULT_AVS_PRODUCT,
    );

    const url = import.meta.env.VITE_SUPABASE_URL as string;
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!url || !token) return { ok: false, error: "Sign in required" };

    const res = await fetch(`${url}/functions/v1/run-whatsapp-campaign`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ campaignId: id, recipients: audience }),
    });
    const body = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok) {
      await get().updateCampaignStatus(id, "FAILED");
      return { ok: false, error: body.error ?? "Campaign launch failed" };
    }
    await get().updateCampaignStatus(id, "COMPLETED");
    return { ok: true };
  },

  saveAudience: async (input) => {
    const count = (await buildCampaignAudience(input.segmentRules)).length;
    await supabase.from("campaign_audiences" as never).insert({
      name: input.name,
      description: input.description ?? null,
      product_id: DEFAULT_AVS_PRODUCT,
      segment_rules: input.segmentRules,
      estimated_count: count,
    } as never);
    await get().hydrate();
  },
}));
