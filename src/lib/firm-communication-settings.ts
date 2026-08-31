/**
 * Firm communication / public-share settings (CVsE73i6 shop parity).
 * Recovered from production-dist-shop manufacturing-bill-store chunk.
 */
import { dataProvider as supabase } from "@/lib/providers/data-provider";

export type FirmCommunicationSettings = {
  firmId: string;
  documentShareTtlHours: number;
  publicShareEnabled: boolean;
  emailFallbackToPlatform: boolean;
};

const DEFAULTS: Omit<FirmCommunicationSettings, "firmId"> = {
  documentShareTtlHours: 24,
  publicShareEnabled: true,
  emailFallbackToPlatform: true,
};

export async function loadFirmCommunicationSettings(): Promise<FirmCommunicationSettings> {
  let firmId = "";
  try {
    const { data } = await (supabase as any).rpc("my_firm_id");
    firmId = data ? String(data) : "";
  } catch {
    firmId = "";
  }

  const { data, error } = await (supabase as any)
    .from("firm_communication_settings")
    .select("*")
    .maybeSingle();

  if (error || !data) {
    return { firmId, ...DEFAULTS };
  }

  const row = data as Record<string, unknown>;
  return {
    firmId: String(row.firm_id ?? firmId),
    documentShareTtlHours: Number(row.document_share_ttl_hours ?? 24),
    publicShareEnabled: row.public_share_enabled !== false,
    emailFallbackToPlatform: row.email_fallback_to_platform !== false,
  };
}

export async function saveFirmCommunicationSettings(
  patch: Partial<Omit<FirmCommunicationSettings, "firmId">>,
): Promise<FirmCommunicationSettings> {
  const current = await loadFirmCommunicationSettings();
  let firmId = current.firmId;
  if (!firmId) {
    try {
      const { data } = await (supabase as any).rpc("my_firm_id");
      firmId = data ? String(data) : "";
    } catch {
      firmId = "";
    }
  }

  const payload = {
    firm_id: firmId || undefined,
    document_share_ttl_hours: Math.min(
      168,
      Math.max(1, patch.documentShareTtlHours ?? current.documentShareTtlHours),
    ),
    public_share_enabled: patch.publicShareEnabled ?? current.publicShareEnabled,
    email_fallback_to_platform:
      patch.emailFallbackToPlatform ?? current.emailFallbackToPlatform,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await (supabase as any)
    .from("firm_communication_settings")
    .upsert(payload, { onConflict: "firm_id" })
    .select("*")
    .maybeSingle();

  if (error || !data) {
    console.warn("[firm-communication-settings] save failed:", error?.message);
    return { ...current, firmId, ...patch };
  }

  const row = data as Record<string, unknown>;
  return {
    firmId: String(row.firm_id ?? firmId),
    documentShareTtlHours: Number(row.document_share_ttl_hours ?? 24),
    publicShareEnabled: row.public_share_enabled !== false,
    emailFallbackToPlatform: row.email_fallback_to_platform !== false,
  };
}
