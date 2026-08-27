import { createFileRoute, Navigate } from "@tanstack/react-router";

/** Compatibility route: manufacturing barcode desk is the stock-backed scanner. */
export const Route = createFileRoute("/coming-soon/barcode-scanner")({
  head: () => ({ meta: [{ title: "Barcode Scanner · AVS Gold ERP" }] }),
  component: () => <Navigate to="/workshop/barcode-scanner" replace />,
});
