import { createFileRoute, Outlet } from "@tanstack/react-router";

import { guardRoute } from "@/lib/permissions";

export const Route = createFileRoute("/catalog")({
  beforeLoad: ({ location }) => guardRoute(location.pathname),
  head: () => ({ meta: [{ title: "Catalog · MTJ ERP" }] }),
  component: () => <Outlet />,
});
