import { createFileRoute, Outlet } from "@tanstack/react-router";

import { guardRoute } from "@/lib/permissions";

export const Route = createFileRoute("/communications")({
  beforeLoad: ({ location }) => guardRoute(location.pathname),
  component: CommunicationsLayout,
});

function CommunicationsLayout() {
  return <Outlet />;
}
