import { createFileRoute, Outlet } from "@tanstack/react-router";

import { guardRoute } from "@/lib/permissions";

export const Route = createFileRoute("/orders")({
  beforeLoad: ({ location }) => guardRoute(location.pathname),
  head: () => ({ meta: [{ title: "Orders · AVS Gold ERP" }] }),
  component: () => <Outlet />,
});
