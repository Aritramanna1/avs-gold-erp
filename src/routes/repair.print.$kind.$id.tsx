/**
 * Repair & Polishing Print Route — Unified Print Engine.
 */
import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useRepairs } from "@/lib/repair-store";
import type { PrintDocType } from "@/lib/printlog-store";
import { PrintEngine } from "@/components/print-engine/PrintEngine";

type Kind = "receipt" | "delivery" | "invoice" | "payment";
const TITLES: Record<Kind, string> = {
  receipt: "Repair Receipt",
  delivery: "Repair Delivery Slip",
  invoice: "Repair Invoice",
  payment: "Payment Receipt",
};

export const Route = createFileRoute("/repair/print/$kind/$id")({
  head: () => ({ meta: [{ title: "Repair Print · AVS Gold ERP" }] }),
  component: RepairPrint,
});

function RepairPrint() {
  const params = useParams({ from: "/repair/print/$kind/$id" });
  const id = params.id;
  const KIND_ALIASES: Record<string, string> = {
    "polishing-receipt": "receipt",
    "polishing-delivery": "delivery",
  };
  const kind = KIND_ALIASES[params.kind] ?? params.kind;
  const r = useRepairs((s) => s.repairs.find((x) => x.id === id));
  const k = TITLES[kind as Kind] ? (kind as Kind) : "receipt";

  if (!r) {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-foreground p-6">
        <div className="text-center space-y-3">
          <h1 className="font-serif text-2xl text-gold">Repair item not found</h1>
          <Link to="/repair" className="text-gold underline">
            Back to Repair
          </Link>
        </div>
      </div>
    );
  }

  const docType: PrintDocType =
    r.kind === "polishing"
      ? "polishing_receipt"
      : k === "invoice"
        ? "repair_invoice"
        : k === "delivery"
          ? "repair_delivery_slip"
          : k === "payment"
            ? "payment_receipt"
            : "repair_receipt";

  return <PrintEngine docType={docType} recordId={r.id} backUrl={`/repair/${r.id}`} />;
}
