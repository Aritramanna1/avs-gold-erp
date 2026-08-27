/**
 * Tenant entitlement snapshot from get_my_tenant_entitlements().
 * Additive layer — does not replace RBAC/permissions.
 */
import { create } from "zustand";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import type { ERPModuleKey } from "@/lib/module-store";

export type TenantEntitlementsState = {
  loaded: boolean;
  loading: boolean;
  features: Record<string, boolean>;
  editionFamily: string | null;
  businessEdition: string | null;
  isMtg: boolean;
  planCode: string | null;
  planName: string | null;
  priceMinor: number | null;
  error: string | null;
  refresh: () => Promise<void>;
  hasFeature: (key: string) => boolean;
  hasModule: (key: ERPModuleKey) => boolean;
};

function asBool(v: unknown): boolean {
  return v === true || v === "true";
}

export const useTenantEntitlements = create<TenantEntitlementsState>((set, get) => ({
  loaded: false,
  loading: false,
  features: {},
  editionFamily: null,
  businessEdition: null,
  isMtg: false,
  planCode: null,
  planName: null,
  priceMinor: null,
  error: null,

  refresh: async () => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase.rpc("get_my_tenant_entitlements");
      if (error) throw error;
      const payload = (data ?? {}) as Record<string, unknown>;
      const featuresRaw = (payload.features ?? {}) as Record<string, unknown>;
      const features: Record<string, boolean> = {};
      for (const [k, v] of Object.entries(featuresRaw)) {
        features[k] = asBool(v);
      }
      const plan = payload.plan as Record<string, unknown> | null;
      const editionFamily =
        (payload.edition_family as string | null) ??
        (plan?.edition_family as string | null) ??
        null;
      const businessEdition =
        (payload.business_edition as string | null) ??
        (plan?.business_edition as string | null) ??
        null;
      const isMtg =
        asBool(payload.is_mtg) || editionFamily === "mtg" || asBool(features["edition.mtg"]);

      set({
        loaded: true,
        loading: false,
        features,
        editionFamily,
        businessEdition,
        isMtg,
        planCode: (plan?.code as string | null) ?? null,
        planName: (plan?.name as string | null) ?? null,
        priceMinor: typeof plan?.price_minor === "number" ? (plan.price_minor as number) : null,
        error: null,
      });
    } catch (err: unknown) {
      set({
        loaded: true,
        loading: false,
        error: err instanceof Error ? err.message : "Failed to load entitlements",
      });
    }
  },

  hasFeature: (key) => {
    const { features, loaded } = get();
    // Fail-open only before first load so boot is not blocked; after load, missing = denied.
    if (!loaded) return true;
    if (Object.keys(features).length === 0) return true; // no rows yet (legacy firms)
    if (key in features) return features[key] === true;
    return false;
  },

  hasModule: (key) => get().hasFeature(key),
}));

/** Sync module_states enabled flags from plan entitlements (additive; manual override preserved server-side). */
export async function syncModuleStatesFromEntitlements(
  branchId: string,
  features: Record<string, boolean>,
): Promise<void> {
  if (!branchId || Object.keys(features).length === 0) return;
  const moduleKeys = [
    "billing",
    "manufacturing",
    "job_work",
    "gst",
    "bullion",
    "melt_account",
    "crm_communications",
    "inventory",
    "repairs",
    "orders",
    "attendance",
    "payroll",
    "hr",
    "loyalty_program",
    "barcode",
    "hardware_integration",
    "whatsapp",
    "email",
    "sms",
    "customer_portal",
    "supplier_management",
    "reports",
    "analytics",
    "multi_branch",
    "catalog",
  ] as const;

  for (const key of moduleKeys) {
    if (!(key in features)) continue;
    const enabled = features[key] === true;
    await supabase.from("module_states").upsert(
      {
        id: `${branchId}:${key}`,
        branch_id: branchId,
        module_key: key,
        enabled,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "id" },
    );
  }
}
