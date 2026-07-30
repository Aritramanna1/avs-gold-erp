import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { ScanLine } from "lucide-react";
import { ModuleWorkspace } from "@/components/module-workspace";
import { useManufacturingBarcodes } from "@/lib/manufacturing-barcode-store";
export const Route = createFileRoute("/barcode")({ component: BarcodeWorkspace });
function BarcodeWorkspace() {
  const barcodes = useManufacturingBarcodes((s) => s.barcodes);
  const refresh = useManufacturingBarcodes((s) => s.refresh);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return (
    <ModuleWorkspace
      eyebrow="Identification"
      title="Barcode & tagging"
      description="Search, identify, and print the active barcode records already connected to manufacturing and stock flows."
      icon={ScanLine}
      onRefresh={() => void refresh()}
      metrics={[
        { label: "Total barcodes", value: barcodes.length },
        { label: "Active", value: barcodes.filter((b) => b.status !== "returned").length },
        {
          label: "Tagged",
          value: barcodes.filter((b) =>
            ["tagged", "ready_for_delivery", "delivered"].includes(b.status),
          ).length,
        },
        { label: "Delivered", value: barcodes.filter((b) => b.status === "delivered").length },
      ]}
      actions={[{ label: "Scan barcode", to: "/workshop/barcode-scanner", icon: ScanLine }]}
    >
      <section className="erp-surface rounded-md p-5">
        <h2 className="font-semibold">Latest barcode records</h2>
        <div className="mt-4 divide-y">
          {barcodes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No barcode records found.</p>
          ) : (
            barcodes.slice(0, 10).map((barcode) => (
              <div className="flex justify-between py-3 text-sm" key={barcode.id}>
                <span className="font-mono">{barcode.barcodeNumber}</span>
                <span className="text-muted-foreground">{barcode.status}</span>
              </div>
            ))
          )}
        </div>
      </section>
    </ModuleWorkspace>
  );
}
