/**
 * Platform Owner communication policy.
 *
 * Email = default automatic business channel.
 * Android native Share = free/manual WhatsApp (and other apps) with documents.
 * Official WhatsApp API/BSP = optional paid automation when enabled.
 * Legacy PHP / custom-connector WhatsApp = disabled by default, preserved.
 */
import { dataProvider as supabase } from "@/lib/providers/data-provider";

export const COMMUNICATION_POLICY_KEYS = {
  whatsappApi: "whatsapp_api_enabled",
  legacyPhp: "legacy_whatsapp_php_enabled",
  whatsappCredits: "whatsapp_credits_enabled",
  aiCredits: "ai_credits_enabled",
} as const;

export interface CommunicationPolicy {
  whatsapp_api_enabled: boolean;
  legacy_whatsapp_php_enabled: boolean;
  whatsapp_credits_enabled: boolean;
  ai_credits_enabled: boolean;
}

export const DEFAULT_COMMUNICATION_POLICY: CommunicationPolicy = {
  whatsapp_api_enabled: false,
  legacy_whatsapp_php_enabled: false,
  whatsapp_credits_enabled: false,
  ai_credits_enabled: false,
};

const LEGACY_PHP_PROVIDER_RE = /php|custom_connector|custom.?php|whatsapp_custom/i;

let cache: CommunicationPolicy | null = null;
let inflight: Promise<CommunicationPolicy> | null = null;

export function parsePlatformBool(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const s = value.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(s)) return true;
    if (["false", "0", "no", "off", ""].includes(s)) return false;
  }
  return fallback;
}

export function getCachedCommunicationPolicy(): CommunicationPolicy {
  return cache ?? { ...DEFAULT_COMMUNICATION_POLICY };
}

export async function loadCommunicationPolicy(force = false): Promise<CommunicationPolicy> {
  if (cache && !force) return cache;
  if (inflight && !force) return inflight;

  inflight = (async () => {
    try {
      const { data, error } = await supabase.rpc("communication_policy" as never);
      if (!error && data && typeof data === "object") {
        const row = data as Record<string, unknown>;
        cache = {
          whatsapp_api_enabled: parsePlatformBool(row.whatsapp_api_enabled, false),
          legacy_whatsapp_php_enabled: parsePlatformBool(row.legacy_whatsapp_php_enabled, false),
          whatsapp_credits_enabled: parsePlatformBool(row.whatsapp_credits_enabled, false),
          ai_credits_enabled: parsePlatformBool(row.ai_credits_enabled, false),
        };
        return cache;
      }
    } catch {
      // RPC may not be applied yet — fall through to table read.
    }

    const { data, error } = await supabase
      .from("platform_settings")
      .select("key,value")
      .in("key", [
        COMMUNICATION_POLICY_KEYS.whatsappApi,
        COMMUNICATION_POLICY_KEYS.legacyPhp,
        COMMUNICATION_POLICY_KEYS.whatsappCredits,
        COMMUNICATION_POLICY_KEYS.aiCredits,
        "integrations.whatsapp_enabled",
      ]);

    if (error) {
      console.warn("[communication-policy] load failed:", error.message);
      cache = { ...DEFAULT_COMMUNICATION_POLICY };
      return cache;
    }

    const map = new Map(
      (data ?? []).map((r: { key: string; value: unknown }) => [r.key, r.value]),
    );
    const api =
      map.has(COMMUNICATION_POLICY_KEYS.whatsappApi)
        ? parsePlatformBool(map.get(COMMUNICATION_POLICY_KEYS.whatsappApi), false)
        : parsePlatformBool(map.get("integrations.whatsapp_enabled"), false);

    cache = {
      whatsapp_api_enabled: api,
      legacy_whatsapp_php_enabled: parsePlatformBool(
        map.get(COMMUNICATION_POLICY_KEYS.legacyPhp),
        false,
      ),
      whatsapp_credits_enabled: parsePlatformBool(
        map.get(COMMUNICATION_POLICY_KEYS.whatsappCredits),
        false,
      ),
      ai_credits_enabled: parsePlatformBool(map.get(COMMUNICATION_POLICY_KEYS.aiCredits), false),
    };
    return cache;
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

export function invalidateCommunicationPolicyCache(): void {
  cache = null;
}

export function isLegacyPhpWhatsAppProvider(providerType: string | null | undefined): boolean {
  return LEGACY_PHP_PROVIDER_RE.test(providerType ?? "");
}

export function canSendOfficialWhatsAppApi(policy?: CommunicationPolicy): boolean {
  return (policy ?? getCachedCommunicationPolicy()).whatsapp_api_enabled;
}

export function canSendLegacyPhpWhatsApp(policy?: CommunicationPolicy): boolean {
  return (policy ?? getCachedCommunicationPolicy()).legacy_whatsapp_php_enabled;
}

export function canDeductWhatsAppCredits(policy?: CommunicationPolicy): boolean {
  const p = policy ?? getCachedCommunicationPolicy();
  return p.whatsapp_api_enabled && p.whatsapp_credits_enabled;
}

export function canDeductAiCredits(policy?: CommunicationPolicy): boolean {
  return (policy ?? getCachedCommunicationPolicy()).ai_credits_enabled;
}

export function whatsappApiBlockedReason(policy?: CommunicationPolicy): string | null {
  if (canSendOfficialWhatsAppApi(policy)) return null;
  return "Official WhatsApp API is turned off. Automatic messages go by Email. Use Share to send this document from WhatsApp on this device.";
}

export function legacyPhpBlockedReason(policy?: CommunicationPolicy): string | null {
  if (canSendLegacyPhpWhatsApp(policy)) return null;
  return "Legacy PHP / custom WhatsApp sending is turned off by Platform Owner.";
}

export async function maybeDeductWhatsAppCredits(opts: {
  serviceCode?: string;
  units?: number;
  referenceId?: string | null;
  description?: string;
}): Promise<{ success: boolean; skipped?: boolean; error?: string }> {
  const policy = await loadCommunicationPolicy();
  if (!canDeductWhatsAppCredits(policy)) {
    return { success: false, skipped: true };
  }
  const { error, data } = await (supabase as never as {
    rpc: (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: { success?: boolean; error?: string } | null; error: { message: string } | null }>;
  }).rpc("deduct_tenant_credits", {
    p_service_code: opts.serviceCode ?? "wa_utility",
    p_units: opts.units ?? 1,
    p_reference_id: opts.referenceId ?? null,
    p_description: opts.description ?? null,
  });
  if (error) return { success: false, error: error.message };
  if (data && data.success === false) {
    return { success: false, skipped: true, error: data.error };
  }
  return { success: true };
}
