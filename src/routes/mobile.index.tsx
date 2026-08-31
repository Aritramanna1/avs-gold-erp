import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy URL — adaptive ERP uses `/` on all devices. */
export const Route = createFileRoute("/mobile/")({
  beforeLoad: () => {
    throw redirect({ to: "/", replace: true });
  },
  component: () => null,
});
