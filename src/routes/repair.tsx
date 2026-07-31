import { createFileRoute, Outlet } from "@tanstack/react-router";
import { guardRoute } from "@/lib/permissions";

// Repair intake and detail screens are implemented by the nested routes. This
// parent owns only the permission boundary and no longer masks them with a
// duplicate Coming Soon screen.
export const Route = createFileRoute("/repair")({
  beforeLoad: ({ location }) => guardRoute(location.pathname),
  head: () => ({ meta: [{ title: "Repair · AVS Gold ERP" }] }),
  component: () => <Outlet />,
});
