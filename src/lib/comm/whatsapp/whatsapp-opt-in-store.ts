/**
 * WhatsApp opt-in / consent tracking (Meta policy compliance).
 */
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { DEFAULT_AVS_PRODUCT } from "@/lib/comm/platform/communication-events";

export type OptInStatus = "opted_in" | "opted_out" | "pending";

export interface WhatsAppOptIn {
  id: string;
  partyId?: string;
  phoneE164: string;
  status: OptInStatus;
  optInAt?: string;
  optOutAt?: string;
  source?: string;
  purpose?: string;
  evidenceRef?: string;
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

export async function fetchOptedInPhones(productId = DEFAULT_AVS_PRODUCT): Promise<Set<string>> {
  const { data } = await supabase
    .from("whatsapp_opt_ins" as never)
    .select("phone_e164")
    .eq("product_id", productId)
    .eq("status", "opted_in");
  return new Set(((data ?? []) as Array<{ phone_e164: string }>).map((r) => r.phone_e164));
}

export async function fetchOptIns(): Promise<WhatsAppOptIn[]> {
  const { data, error } = await supabase
    .from("whatsapp_opt_ins" as never)
    .select("*")
    .eq("product_id", DEFAULT_AVS_PRODUCT)
    .order("updated_at", { ascending: false });
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    partyId: row.party_id ? String(row.party_id) : undefined,
    phoneE164: String(row.phone_e164),
    status: String(row.status) as OptInStatus,
    optInAt: row.opt_in_at ? String(row.opt_in_at) : undefined,
    optOutAt: row.opt_out_at ? String(row.opt_out_at) : undefined,
    source: row.source ? String(row.source) : undefined,
    purpose: row.purpose ? String(row.purpose) : undefined,
    evidenceRef: row.evidence_ref ? String(row.evidence_ref) : undefined,
  }));
}

export async function upsertOptIn(input: {
  partyId?: string;
  phone: string;
  status: OptInStatus;
  source?: string;
  purpose?: string;
  evidenceRef?: string;
}): Promise<void> {
  const phone_e164 = normalizePhone(input.phone);
  const now = new Date().toISOString();
  await supabase.from("whatsapp_opt_ins" as never).upsert(
    {
      party_id: input.partyId ?? null,
      phone_e164,
      product_id: DEFAULT_AVS_PRODUCT,
      status: input.status,
      opt_in_at: input.status === "opted_in" ? now : null,
      opt_out_at: input.status === "opted_out" ? now : null,
      source: input.source ?? null,
      purpose: input.purpose ?? null,
      evidence_ref: input.evidenceRef ?? null,
      updated_at: now,
    } as never,
    { onConflict: "firm_id,product_id,phone_e164" },
  );
}

export async function isPhoneOptedIn(
  phone: string,
  productId = DEFAULT_AVS_PRODUCT,
): Promise<boolean> {
  const phone_e164 = normalizePhone(phone);
  const { data } = await supabase
    .from("whatsapp_opt_ins" as never)
    .select("status")
    .eq("product_id", productId)
    .eq("phone_e164", phone_e164)
    .maybeSingle();
  return (data as { status?: string } | null)?.status === "opted_in";
}
