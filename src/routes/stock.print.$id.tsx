/**
 * Stock / Manufacturing Jewellery Tag Print Route — Unified Print Engine.
 */
import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useStock } from "@/lib/stock-store";
import { useManufacturingBarcodes } from "@/lib/manufacturing-barcode-store";
import { PrintEngine } from "@/components/print-engine/PrintEngine";

export const Route = createFileRoute("/stock/print/$id")({
  head: () => ({ meta: [{ title: "Jewellery Tag Print · AVS ERP" }] }),
  component: TagPreview,
});

function TagPreview() {
  const { id } = useParams({ from: "/stock/print/$id" });
  const stockItem = useStock((s) => s.items.find((i) => i.id === id));
  const mfg = useManufacturingBarcodes((s) => s.barcodes.find((b) => b.id === id));

  if (!stockItem && !mfg) {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-foreground p-6">
        <div className="text-center space-y-3">
          <h1 className="font-serif text-2xl text-gold">Tag record not found</h1>
          <Link to="/stock" className="text-gold underline">
            Back to Stock
          </Link>
        </div>
      </div>
    );
  }

  return (
    <PrintEngine
      docType="jewellery_tag"
      recordId={id}
      backUrl={mfg ? "/manufacturing" : "/stock"}
    />
  );
}
