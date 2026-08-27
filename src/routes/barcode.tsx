import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Printer, ScanLine } from "lucide-react";
import { ModuleWorkspace } from "@/components/module-workspace";
import { BARCODE_STATUS_LABELS, useManufacturingBarcodes } from "@/lib/manufacturing-barcode-store";
import { ManufacturingTagPrintDialog } from "@/components/manufacturing-tag-print-dialog";

export const Route = createFileRoute("/barcode")({ component: BarcodeWorkspace });

function BarcodeWorkspace() {
  const search = useSearch({ from: "/barcode" }) as { selected?: string };
  const barcodes = useManufacturingBarcodes((s) => s.barcodes);
  const refresh = useManufacturingBarcodes((s) => s.refresh);
  const selected = barcodes.find((barcode) => barcode.id === search.selected) ?? null;
  const [printOpen, setPrintOpen] = useState(false);

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
      {selected && (
        <section className="erp-surface mb-5 rounded-md p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Selected tag</p>
              <h2 className="mt-1 font-mono text-lg font-semibold">{selected.barcodeNumber}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {selected.productDescription} - {selected.orderNo} -{" "}
                {BARCODE_STATUS_LABELS[selected.status] ?? selected.status}
              </p>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <dt className="text-xs text-muted-foreground">Tag number</dt>
                  <dd className="font-mono">{selected.tagNumber}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Internal product</dt>
                  <dd className="font-mono">{selected.internalProductId}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Gross weight</dt>
                  <dd>{(selected.grossMg / 1000).toFixed(3)} g</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Fine weight</dt>
                  <dd>{(selected.fineMg / 1000).toFixed(3)} g</dd>
                </div>
              </dl>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setPrintOpen(true)}
                className="inline-flex items-center rounded-md border px-3 py-2 text-sm hover:bg-accent"
              >
                <Printer className="mr-2 h-4 w-4" />
                Print tag
              </button>
              <Link
                to="/workshop/barcode-scanner"
                className="inline-flex items-center rounded-md border px-3 py-2 text-sm hover:bg-accent"
              >
                <ScanLine className="mr-2 h-4 w-4" />
                Scanner desk
              </Link>
              <Link
                to="/stock"
                className="inline-flex items-center rounded-md border px-3 py-2 text-sm hover:bg-accent"
              >
                Open stock
              </Link>
              <Link
                to="/billing"
                className="inline-flex items-center rounded-md border px-3 py-2 text-sm hover:bg-accent"
              >
                Sale / bill
              </Link>
            </div>
          </div>
        </section>
      )}

      <section className="erp-surface rounded-md p-5">
        <h2 className="font-semibold">Latest barcode records</h2>
        <div className="mt-4 divide-y">
          {barcodes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No barcode records found.</p>
          ) : (
            barcodes.slice(0, 10).map((barcode) => (
              <div
                className={`flex flex-wrap justify-between gap-3 py-3 text-sm ${
                  barcode.id === selected?.id ? "text-gold" : ""
                }`}
                key={barcode.id}
              >
                <Link
                  to="/barcode"
                  search={{ selected: barcode.id } as any}
                  className="font-mono hover:underline"
                >
                  {barcode.barcodeNumber}
                </Link>
                <span className="text-muted-foreground">
                  {BARCODE_STATUS_LABELS[barcode.status] ?? barcode.status}
                </span>
              </div>
            ))
          )}
        </div>
      </section>

      <ManufacturingTagPrintDialog
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        barcode={selected}
      />
    </ModuleWorkspace>
  );
}
