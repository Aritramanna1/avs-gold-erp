import { createFileRoute, Outlet } from "@tanstack/react-router";
import { guardRoute } from "@/lib/permissions";

// The nested attendance index owns the implemented payroll workflow. This
// parent only provides the route-level permission boundary.
export const Route = createFileRoute("/attendance")({
  beforeLoad: ({ location }) => guardRoute(location.pathname),
  head: () => ({ meta: [{ title: "Attendance & Payroll · AVS Gold ERP" }] }),
  component: () => <Outlet />,
});
