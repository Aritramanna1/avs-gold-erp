import { createFileRoute, Navigate } from "@tanstack/react-router";

/** Compatibility route: scanner diagnostics live in the unified hardware workspace. */
export const Route = createFileRoute("/coming-soon/barcode-scanner")({
  head: () => ({ meta: [{ title: "Barcode Scanner · AVS Gold ERP" }] }),
  component: () => <Navigate to="/hardware" replace />,
});
