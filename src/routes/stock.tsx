import { createFileRoute, Outlet } from "@tanstack/react-router";

import { guardRoute } from "@/lib/permissions";

export const Route = createFileRoute("/stock")({
  beforeLoad: ({ location }) => guardRoute(location.pathname),
  head: () => ({ meta: [{ title: "Stock · AVS Gold ERP" }] }),
  component: () => <Outlet />,
});
