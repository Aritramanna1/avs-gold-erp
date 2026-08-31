import { createFileRoute, redirect } from "@tanstack/react-router";

import { guardRoute } from "@/lib/permissions";

export const Route = createFileRoute("/melt")({
  beforeLoad: ({ location }) => {
    guardRoute(location.pathname);
    throw redirect({ to: "/conversion" });
  },
});
