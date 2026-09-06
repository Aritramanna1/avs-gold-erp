/**
 * Firm-scoped app_settings keys.
 *
 * The main firm settings blob uses id = firm UUID.
 * Satellite settings (comms, billing prefs, workflow, etc.) use `{firmId}:{key}`
 * so each shop keeps its own row under RLS (firm_id = my_firm_id()).
 */
import { getCloudDataClient as getRawSupabaseClient } from "@/lib/providers/data-provider";

export const FIRM_SATELLITE_SETTINGS_KEYS = [
  "comm_configs",
  "business_rules",
  "billing_prefs",
  "whatsapp_templates",
  "gold_calculation_rules",
  "customization_hub",
  "barcode_config",
  "workflow_engine",
  "terminology_engine",
  "comm_automation_rules",
  "expenses_store",
  "backup_scheduler",
  "weekly_statements",
] as const;

export type FirmSatelliteSettingsKey = (typeof FIRM_SATELLITE_SETTINGS_KEYS)[number];

const SATELLITE_SET = new Set<string>(FIRM_SATELLITE_SETTINGS_KEYS);

const FIRM_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isFirmSatelliteSettingsKey(id: string): boolean {
  return SATELLITE_SET.has(id);
}

/** True when id is the main firm settings blob (bare firm UUID). */
export function isMainFirmSettingsId(id: string | null | undefined): boolean {
  if (!id) return false;
  if (id === "firm") return true;
  return FIRM_UUID_RE.test(id) && !id.includes(":");
}

/**
 * Resolve the storage id for an app_settings row.
 * Satellite logical keys become `{firmId}:{key}`. Legacy `firm` becomes firm UUID.
 */
export function resolveFirmAppSettingsId(
  rawId: string,
  firmId: string | null | undefined,
): string {
  if (!rawId) return rawId;
  if (firmId && (rawId === firmId || rawId.startsWith(`${firmId}:`))) return rawId;
  // Already scoped for some firm (uuid:key) — leave as-is for reads of known rows.
  if (rawId.includes(":")) return rawId;
  if (rawId === "firm") return firmId || rawId;
  if (SATELLITE_SET.has(rawId)) {
    if (!firmId) return rawId;
    return `${firmId}:${rawId}`;
  }
  return rawId;
}

export function satelliteKeyFromScopedId(scopedId: string): string | null {
  const idx = scopedId.indexOf(":");
  if (idx <= 0) return null;
  const key = scopedId.slice(idx + 1);
  return SATELLITE_SET.has(key) ? key : null;
}

let cachedFirmId: string | null | undefined;

/** Clear cached firm id (e.g. on sign-out). */
export function clearCachedFirmId(): void {
  cachedFirmId = undefined;
}

export async function resolveCurrentFirmId(): Promise<string | null> {
  if (cachedFirmId !== undefined) return cachedFirmId;
  const supabase = getRawSupabaseClient();
  try {
    const { data: rpcFirm, error: rpcError } = await (supabase as any).rpc("my_firm_id");
    if (!rpcError && rpcFirm) {
      cachedFirmId = String(rpcFirm);
      return cachedFirmId;
    }
    const { data: sessionResult } = await supabase.auth.getSession();
    const userId = sessionResult.session?.user?.id;
    if (!userId) {
      cachedFirmId = null;
      return null;
    }
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("firm_id")
      .eq("auth_id", userId)
      .maybeSingle();
    const fromProfile = (profile as { firm_id?: string | null } | null)?.firm_id ?? null;
    if (fromProfile) {
      cachedFirmId = fromProfile;
      return cachedFirmId;
    }

    // SaaS admins: my_firm_id() is intentionally null. Still resolve via active
    // membership so Settings / app_settings writes and reads can target a firm.
    const { data: membership } = await (supabase as any)
      .from("tenant_memberships")
      .select("organization_id")
      .eq("auth_user_id", userId)
      .eq("status", "active")
      .order("last_active_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    cachedFirmId =
      (membership as { organization_id?: string | null } | null)?.organization_id ?? null;
    return cachedFirmId;
  } catch {
    cachedFirmId = null;
    return null;
  }
}

/**
 * Resolve a read id for app_settings: prefer firm-scoped key, then bare legacy
 * key (RLS still limits visibility to the caller's firm).
 */
export async function resolveAppSettingsReadId(rawId: string): Promise<string> {
  const firmId = await resolveCurrentFirmId();
  return resolveFirmAppSettingsId(rawId, firmId);
}
