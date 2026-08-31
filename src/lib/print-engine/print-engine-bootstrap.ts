/**
 * Hydrate print templates and profiles after authentication.
 */
import { usePrintTemplates } from "@/lib/print-engine/template-store";
import { usePrintProfiles } from "@/lib/print-engine/profile-store";

let bootstrapPromise: Promise<void> | null = null;

export async function hydratePrintEngineStores(): Promise<void> {
  if (bootstrapPromise) return bootstrapPromise;
  bootstrapPromise = (async () => {
    const tpl = usePrintTemplates.getState();
    const prof = usePrintProfiles.getState();
    await Promise.all([
      tpl.loaded ? Promise.resolve() : tpl.refresh(),
      prof.loaded ? Promise.resolve() : prof.refresh(),
    ]);
  })();
  return bootstrapPromise;
}
