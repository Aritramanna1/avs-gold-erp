/**
 * Apply saved print profile defaults to session print-setup (user may override).
 */
import { usePrintSetup } from "@/lib/print-setup-store";
import { usePrintProfiles } from "@/lib/print-engine/profile-store";
import type { PrintDocType, PrintSize } from "./types";

export function applyPrintProfileForDoc(
  docType: PrintDocType,
  paperSize: PrintSize,
  templateMargins?: { top: number; right: number; bottom: number; left: number },
): void {
  const profile = usePrintProfiles.getState().getForDocType(docType, paperSize);
  const setup = usePrintSetup.getState();
  setup.setMargins(templateMargins ?? profile.margins);
  setup.setScalePct(profile.scale);
  setup.setFitToPage(profile.fitToPage);
  setup.setSizeOverride(profile.paperSize);
  setup.setOrientation(profile.orientation === "landscape" ? "landscape" : "portrait");
}
