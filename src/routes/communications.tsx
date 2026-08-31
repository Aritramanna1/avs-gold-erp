import { createFileRoute, Outlet } from "@tanstack/react-router";

/** Compatibility route for the communications hub. */
export const Route = createFileRoute("/communications")({
  head: () => ({ meta: [{ title: "Communications · AVS Gold ERP" }] }),
  component: () => <Outlet />,
});
