import { createFileRoute, redirect } from "@tanstack/react-router";

import { guardRoute } from "@/lib/permissions";

export const Route = createFileRoute("/invite")({
  beforeLoad: ({ location }) => {
    guardRoute(location.pathname);
    throw redirect({ to: "/invite/accept", replace: true });
  },
  component: () => null,
});
