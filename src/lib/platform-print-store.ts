/**
 * Hydrate platform billing docs for Universal Print Engine (sync builders).
 */
import { create } from "zustand";
import { loadPlatformPrintDocument, type PlatformPrintDoc } from "@/lib/platform-invoice-adapter";
import {
  brandingToPdfInputAsync,
  loadPlatformBrandingSettings,
  type PlatformBrandingSettings,
} from "@/lib/platform-branding";
import type { PlatformBranding } from "@/lib/platform-billing-pdf";
import { dataProvider as supabase } from "@/lib/providers/data-provider";

export type PlatformPrintCacheEntry = {
  doc: PlatformPrintDoc;
  buyerName: string;
  buyerAddress: string | null;
  buyerGstin: string | null;
  branding: PlatformBranding;
  settings: PlatformBrandingSettings;
};

type PlatformPrintState = {
  byId: Record<string, PlatformPrintCacheEntry>;
  ensure: (id: string) => Promise<PlatformPrintCacheEntry | null>;
  get: (id: string) => PlatformPrintCacheEntry | null;
};

export const usePlatformPrintStore = create<PlatformPrintState>((set, get) => ({
  byId: {},
  get: (id) => get().byId[id] ?? null,
  ensure: async (id) => {
    const cached = get().byId[id];
    if (cached) return cached;

    const { doc, error } = await loadPlatformPrintDocument(id);
    if (error || !doc) return null;

    const [{ data: firmRow }, settings] = await Promise.all([
      supabase
        .from("organizations" as never)
        .select("id,name,gstin,address")
        .eq("id", doc.firm_id)
        .maybeSingle(),
      loadPlatformBrandingSettings(),
    ]);
    const firm = firmRow as { name?: string; gstin?: string | null; address?: string | null } | null;
    const branding = await brandingToPdfInputAsync(settings);

    const entry: PlatformPrintCacheEntry = {
      doc,
      buyerName: firm?.name ?? doc.firm_id,
      buyerAddress: firm?.address ?? null,
      buyerGstin: firm?.gstin ?? null,
      branding,
      settings,
    };
    set((s) => ({ byId: { ...s.byId, [id]: entry } }));
    return entry;
  },
}));

export async function ensurePlatformPrintDoc(id: string) {
  return usePlatformPrintStore.getState().ensure(id);
}
