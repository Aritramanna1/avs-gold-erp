import { createFileRoute, Navigate } from "@tanstack/react-router";

/** Compatibility route: Meena is implemented by the shared workshop process page. */
export const Route = createFileRoute("/coming-soon/meena-book")({
  head: () => ({ meta: [{ title: "Meena Book · AVS Gold ERP" }] }),
  component: () => <Navigate to="/workshop/process/$type" params={{ type: "meena" }} replace />,
});
