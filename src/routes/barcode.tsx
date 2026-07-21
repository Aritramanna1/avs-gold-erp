/**
 * Barcode & Tagging — module landing.
 *
 * Kept visible in navigation but showing a professional Coming Soon placeholder
 * until development begins. The underlying architecture stays ready: the label /
 * thermal printing paths (`thermal-printer.ts`, `BarcodeLabelPreview`,
 * `manufacturing-tag-print-dialog`) and the barcode/QR stores are intact and
 * still used by Stock and the tag-print dialogs — only this workspace landing is
 * deferred.
 */
import { createFileRoute } from "@tanstack/react-router";
import { guardRoute } from "@/lib/permissions";
import { ModuleComingSoon } from "@/components/ModuleComingSoon";
import { ScanLine } from "lucide-react";

export const Route = createFileRoute("/barcode")({
  beforeLoad: ({ location }) => guardRoute(location.pathname),
  head: () => ({ meta: [{ title: "Barcode & Tagging · AVS Gold ERP" }] }),
  component: BarcodeComingSoon,
});

function BarcodeComingSoon() {
  return (
    <ModuleComingSoon
      title="Barcode & Tagging"
      message="The Barcode & Tagging workspace is under active development. Scanning, jewellery tag design, and label printing will land here. The tag/label printing paths and QR stores are already in place — this workspace is being built."
      icon={ScanLine}
    />
  );
}
