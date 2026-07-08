import { createFileRoute, Outlet } from "@tanstack/react-router";
import { RequireAction } from "@/components/role-gate";

import { guardRoute } from "@/lib/permissions";

export const Route = createFileRoute("/billing")({
  beforeLoad: ({ location }) => guardRoute(location.pathname),
  head: () => ({ meta: [{ title: "Billing · MTJ ERP" }] }),
  component: () => (
    <RequireAction action="billing.view" label="Billing">
      <Outlet />
    </RequireAction>
  ),
});
