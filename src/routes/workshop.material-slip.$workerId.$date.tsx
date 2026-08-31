/**
 * Daily Material Slip — now rendered by the Universal Print Engine.
 *
 * The slip's identity is (workerId, date); we encode it as the engine's opaque
 * `recordId` (`workerId~date`), and the `daily_material_slip` data-mapper builder
 * (print-engine/data-mapper.ts) turns it into render-ready PrintDocumentData.
 * All layout, preview, printer selection, PDF generation and reprint-audit come
 * from the shared engine — no bespoke print markup lives here any more.
 */
import { createFileRoute, useParams } from "@tanstack/react-router";
import { PrintEngine } from "@/components/print-engine/PrintEngine";

export const Route = createFileRoute("/workshop/material-slip/$workerId/$date")({
  head: () => ({ meta: [{ title: "Daily Material Slip · AVS Gold ERP" }] }),
  component: MaterialSlipPage,
});

function MaterialSlipPage() {
  const { workerId, date } = useParams({ from: "/workshop/material-slip/$workerId/$date" });
  return (
    <PrintEngine
      docType="daily_material_slip"
      recordId={`${workerId}~${date}`}
      backUrl="/workshop/gold-book"
    />
  );
}
