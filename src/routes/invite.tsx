import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";

import { guardRoute } from "@/lib/permissions";

export const Route = createFileRoute("/invite")({
  beforeLoad: ({ location }) => {
    guardRoute(location.pathname);
    // beforeLoad on this route also runs for every child route match
    // (e.g. /invite/accept, since InviteAcceptRoute's parent is this route)
    // — redirecting unconditionally sent /invite/accept right back to
    // itself on every navigation, an infinite redirect loop that never
    // fires the page's "load" event. Only the bare /invite path needs
    // forwarding to the accept screen.
    if (location.pathname === "/invite") {
      throw redirect({ to: "/invite/accept", replace: true });
    }
  },
  // This route is /invite/accept's parent in the route tree, so it stays
  // mounted while that child renders — it must render <Outlet/> to let the
  // child's content through. The previous `() => null` left /invite/accept
  // (and any future child route) permanently blank: beforeLoad completing
  // cleanly is not enough on its own, since a parent with no <Outlet/>
  // renders nothing regardless of what the matched child route returns.
  component: Outlet,
});
