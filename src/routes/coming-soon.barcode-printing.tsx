import { createFileRoute, Navigate } from "@tanstack/react-router";

/** Compatibility route: barcode/tag printing lives in the unified hardware workspace. */
export const Route = createFileRoute("/coming-soon/barcode-printing")({
  head: () => ({ meta: [{ title: "Barcode Printing · AVS Gold ERP" }] }),
  component: () => <Navigate to="/hardware" replace />,
});
