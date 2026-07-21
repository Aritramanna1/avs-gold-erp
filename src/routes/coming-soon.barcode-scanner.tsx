import { createFileRoute } from "@tanstack/react-router";
import { ModuleComingSoon } from "@/components/ModuleComingSoon";
import { ScanLine } from "lucide-react";

export const Route = createFileRoute("/coming-soon/barcode-scanner")({
  head: () => ({ meta: [{ title: "Barcode Scanner · AVS Gold ERP" }] }),
  component: () => (
    <ModuleComingSoon
      title="Barcode Scanner (COMING SOON)"
      message="The manufacturing barcode scanning workspace is planned and will appear here when implementation is complete."
      icon={ScanLine}
    />
  ),
});
