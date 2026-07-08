import { createFileRoute, Outlet } from "@tanstack/react-router";

import { guardRoute } from "@/lib/permissions";

export const Route = createFileRoute("/manufacturing")({
  beforeLoad: ({ location }) => guardRoute(location.pathname),
  component: () => <Outlet />,
});
