import { createFileRoute } from "@tanstack/react-router";
import { ModuleComingSoon } from "@/components/ModuleComingSoon";
import { ScanLine } from "lucide-react";

export const Route = createFileRoute("/coming-soon/barcode-printing")({
  head: () => ({ meta: [{ title: "Barcode Printing · AVS Gold ERP" }] }),
  component: () => (
    <ModuleComingSoon
      title="Barcode Printing (COMING SOON)"
      message="The manufacturing barcode and jewellery-tag printing workspace is planned and will use the Universal Print Engine."
      icon={ScanLine}
    />
  ),
});
