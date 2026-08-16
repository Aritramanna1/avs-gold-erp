/**
 * Runtime loaders for platform_settings keys consumed by Platform Owner billing/UI.
 */
import { dataProvider as supabase } from "@/lib/providers/data-provider";

export interface PlatformBillingDefaults {
  sellerStateCode: string;
  defaultGstRatePercent: number;
  whatsappEnabled: boolean;
  whatsappProvider: string;
}

const DEFAULTS: PlatformBillingDefaults = {
  sellerStateCode: "19",
  defaultGstRatePercent: 18,
  whatsappEnabled: true,
  whatsappProvider: "wasenderapi",
};

let cache: PlatformBillingDefaults | null = null;

export async function loadPlatformBillingDefaults(force = false): Promise<PlatformBillingDefaults> {
  if (cache && !force) return cache;

  const keys = [
    "billing.seller_state_code",
    "billing.default_gst_rate",
    "integrations.whatsapp_enabled",
    "integrations.whatsapp_provider",
  ];

  const { data, error } = await supabase
    .from("platform_settings")
    .select("key,value")
    .in("key", keys);

  if (error) {
    console.warn("[platform-settings-runtime] load failed:", error.message);
    cache = { ...DEFAULTS };
    return cache;
  }

  const map = new Map((data ?? []).map((r: { key: string; value: unknown }) => [r.key, r.value]));
  cache = {
    sellerStateCode: String(map.get("billing.seller_state_code") ?? DEFAULTS.sellerStateCode),
    defaultGstRatePercent: Number(
      map.get("billing.default_gst_rate") ?? DEFAULTS.defaultGstRatePercent,
    ),
    whatsappEnabled: String(map.get("integrations.whatsapp_enabled") ?? "true") === "true",
    whatsappProvider: String(
      map.get("integrations.whatsapp_provider") ?? DEFAULTS.whatsappProvider,
    ),
  };
  return cache;
}

export function getCachedPlatformBillingDefaults(): PlatformBillingDefaults {
  return cache ?? { ...DEFAULTS };
}
