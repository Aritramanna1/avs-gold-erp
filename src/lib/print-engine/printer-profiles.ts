/**
 * Unified Print Engine — Printer Profiles.
 *
 * settings-store.ts already has a complete PrinterProfile CRUD (id/name/
 * type/paperSize/orientation/margins/colorMode/defaultCopies/quality/
 * archivalMode/templateMapping) with 3 seeded defaults — this is a thin,
 * typed re-export plus one resolver helper, not new storage. Reuse, not
 * a parallel printer-profile system.
 */
import { useSettings, type PrinterProfile } from "@/lib/settings-store";

export type { PrinterProfile };

export function usePrinterProfiles(): PrinterProfile[] {
  return useSettings((s) => s.printerProfiles);
}

/**
 * First printer profile whose templateMapping includes `docLabel` (the
 * human label a template/document is filed under, e.g. "Invoice",
 * "Receipt", "Job Card" — matching the labels already used in
 * DEFAULT_PRINTER_PROFILES' templateMapping arrays).
 */
export function resolvePrinterProfileFor(docLabel: string): PrinterProfile | undefined {
  return useSettings.getState().printerProfiles.find((p) => p.templateMapping.includes(docLabel));
}

export const { setPrinterProfiles, addPrinterProfile, updatePrinterProfile, removePrinterProfile } =
  useSettings.getState();
