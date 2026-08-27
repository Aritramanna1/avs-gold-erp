import { createFileRoute, Navigate } from "@tanstack/react-router";

/** Compatibility route: barcode/tag printing uses manufacturing barcode + print engine. */
export const Route = createFileRoute("/coming-soon/barcode-printing")({
  head: () => ({ meta: [{ title: "Barcode Printing · AVS Gold ERP" }] }),
  component: () => <Navigate to="/workshop/barcode-scanner" replace />,
});
