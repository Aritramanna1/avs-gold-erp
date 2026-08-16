/**
 * Stock Barcode & Jewellery Tag Print Route — Unified Print Engine.
 */
import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useStock } from "@/lib/stock-store";
import { PrintEngine } from "@/components/print-engine/PrintEngine";

export const Route = createFileRoute("/stock/print/$id")({
  head: () => ({ meta: [{ title: "Jewellery Tag Print · AVS Gold ERP" }] }),
  component: TagPreview,
});

function TagPreview() {
  const { id } = useParams({ from: "/stock/print/$id" });
  const item = useStock((s) => s.items.find((i) => i.id === id));

  if (!item) {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-foreground p-6">
        <div className="text-center space-y-3">
          <h1 className="font-serif text-2xl text-gold">Stock Item not found</h1>
          <Link to="/stock" className="text-gold underline">
            Back to Stock
          </Link>
        </div>
      </div>
    );
  }

  return <PrintEngine docType="jewellery_tag" recordId={item.id} backUrl="/stock" />;
}
