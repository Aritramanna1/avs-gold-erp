import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/mobile/master")({
  beforeLoad: () => {
    throw redirect({ to: "/master", replace: true });
  },
  component: () => null,
});
